import { type Client, isFullPage } from "@notionhq/client";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  queryPagesToEnrich,
  extractIsbn,
  updatePageFromBook,
  pageMetadataDiffersFromBook,
  groupPageIdsByNormalizedIsbn,
  canonicalPageIdForIsbnGroup,
  findPageIdsWithSameNormalizedIsbn,
  buildPatchForEmptyBookFieldsOnly,
  updatePageFromBookEmptyFieldsOnly,
} from "./notion.js";
import { fetchBookByIsbn } from "./googleBooks.js";
import { normalizeIsbn } from "./isbn.js";

function normalizeNotionId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/** Skip overlapping webhook runs for the same page on one instance. */
const enrichInFlight = new Set<string>();

export type TryEnrichPageResult =
  | "enriched"
  | "skipped"
  | "failed"
  | "not_applicable"
  | "duplicate";

/**
 * Fetches one page by id. If it belongs to databaseId and has ISBN,
 * looks up Google Books and updates the row when metadata differs from the API.
 */
export async function tryEnrichPageById(
  notion: Client,
  databaseId: string,
  pageId: string,
  options?: { skipRateLimitDelay?: boolean }
): Promise<TryEnrichPageResult> {
  if (enrichInFlight.has(pageId)) return "skipped";
  enrichInFlight.add(pageId);
  try {
    return await tryEnrichPageByIdInner(notion, databaseId, pageId, options);
  } finally {
    enrichInFlight.delete(pageId);
  }
}

async function tryEnrichPageByIdInner(
  notion: Client,
  databaseId: string,
  pageId: string,
  options?: { skipRateLimitDelay?: boolean }
): Promise<TryEnrichPageResult> {
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (!isFullPage(page)) return "not_applicable";

  if (page.parent.type !== "database_id") return "not_applicable";
  if (
    normalizeNotionId(page.parent.database_id) !==
    normalizeNotionId(databaseId)
  ) {
    return "not_applicable";
  }

  const rawIsbn = extractIsbn(page);
  if (!rawIsbn) return "skipped";

  const norm = normalizeIsbn(rawIsbn);
  if (norm) {
    const sameIsbn = await findPageIdsWithSameNormalizedIsbn(
      notion,
      databaseId,
      norm
    );
    if (sameIsbn.length > 1) {
      const canonical = canonicalPageIdForIsbnGroup(sameIsbn);
      if (pageId !== canonical) {
        console.warn(
          `[${pageId}] Duplicate ISBN ${norm}; canonical row is ${canonical}. Skipping.`
        );
        return "duplicate";
      }
    }
  }

  const book = await fetchBookByIsbn(rawIsbn);
  if (!book) return "skipped";

  if (!pageMetadataDiffersFromBook(page, book)) return "skipped";

  try {
    await updatePageFromBook(notion, pageId, book, {
      rateLimitDelayMs: options?.skipRateLimitDelay ? 0 : undefined,
      page,
    });
    return "enriched";
  } catch {
    return "failed";
  }
}

export interface EnrichSummary {
  enriched: number;
  skipped: number;
  failed: number;
  duplicates: number;
}

export interface EmptyFieldFillSummary {
  filled: number;
  skipped: number;
  failed: number;
  duplicates: number;
}

const DEFAULT_DAILY_INTERVAL_MS = 86_400_000;

function parseDailyIntervalMs(): number {
  const raw = process.env.MAKTABA_DAILY_INTERVAL_MS;
  if (!raw) return DEFAULT_DAILY_INTERVAL_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 60_000 ? n : DEFAULT_DAILY_INTERVAL_MS;
}

function defaultDailyStatePath(): string {
  const fromEnv = process.env.MAKTABA_DAILY_STATE_FILE?.trim();
  return fromEnv && fromEnv.length > 0
    ? fromEnv
    : join(process.cwd(), ".maktaba-daily-fill.json");
}

function readLastDailyRunMs(statePath: string): number {
  if (!existsSync(statePath)) return 0;
  try {
    const raw = readFileSync(statePath, "utf8");
    const j = JSON.parse(raw) as { lastRunMs?: number };
    return typeof j.lastRunMs === "number" && Number.isFinite(j.lastRunMs)
      ? j.lastRunMs
      : 0;
  } catch {
    return 0;
  }
}

function writeLastDailyRunMs(statePath: string): void {
  writeFileSync(
    statePath,
    `${JSON.stringify({ lastRunMs: Date.now() }, null, 2)}\n`,
    "utf8"
  );
}

/**
 * ISBN rows only: for each page, looks up Google Books and writes API values
 * into **empty** managed fields only (does not overwrite filled Name, Author, etc.).
 */
export async function fillEmptyBookFieldsFromIsbnOnce(
  notion: Client,
  databaseId: string,
  options?: { quietWhenEmpty?: boolean; skipRateLimitDelay?: boolean }
): Promise<EmptyFieldFillSummary> {
  const quietWhenEmpty = options?.quietWhenEmpty ?? false;
  const delayOpts = options?.skipRateLimitDelay
    ? { rateLimitDelayMs: 0 as number }
    : undefined;

  if (!quietWhenEmpty) {
    console.log(
      `[Maktaba] Daily fill — rows with ISBN, patching only empty managed fields…`
    );
  }

  const pages = await queryPagesToEnrich(notion, databaseId);

  if (pages.length === 0) {
    if (!quietWhenEmpty) {
      console.log("[Maktaba] No ISBN rows. Done.");
    }
    return { filled: 0, skipped: 0, failed: 0, duplicates: 0 };
  }

  if (!quietWhenEmpty) {
    console.log(`[Maktaba] Scanning ${pages.length} page(s).\n`);
  }

  const byNormIsbn = groupPageIdsByNormalizedIsbn(pages);
  let filled = 0;
  let skipped = 0;
  let failed = 0;
  let duplicates = 0;

  for (const page of pages) {
    const pageId = page.id;
    const rawIsbn = extractIsbn(page);

    if (!rawIsbn) {
      skipped++;
      continue;
    }

    const norm = normalizeIsbn(rawIsbn);
    if (norm) {
      const group = byNormIsbn.get(norm);
      if (group && group.length > 1) {
        const canonical = canonicalPageIdForIsbnGroup(group);
        if (pageId !== canonical) {
          duplicates++;
          continue;
        }
      }
    }

    const book = await fetchBookByIsbn(rawIsbn);
    if (!book) {
      skipped++;
      continue;
    }

    if (!buildPatchForEmptyBookFieldsOnly(page, book)) {
      skipped++;
      continue;
    }

    if (!quietWhenEmpty) {
      console.log(`[${pageId}] ISBN ${rawIsbn} — filling empty fields`);
    }

    try {
      const did = await updatePageFromBookEmptyFieldsOnly(
        notion,
        pageId,
        book,
        page,
        delayOpts
      );
      if (did) filled++;
      else skipped++;
    } catch {
      failed++;
    }
  }

  if (!quietWhenEmpty) {
    console.log("─".repeat(50));
    console.log(
      `[Maktaba] Empty-field fill done.  Filled: ${filled}  |  Skipped: ${skipped}  |  Duplicates: ${duplicates}  |  Failed: ${failed}`
    );
  }

  return { filled, skipped, failed, duplicates };
}

/**
 * Runs {@link fillEmptyBookFieldsFromIsbnOnce} at most once per interval (default 24h),
 * using a local state file so CLI `--daily` does not re-scan all day.
 */
export async function runDailyEmptyFieldFillIfDue(
  notion: Client,
  databaseId: string,
  options?: {
    stateFilePath?: string;
    intervalMs?: number;
    quiet?: boolean;
    skipRateLimitDelay?: boolean;
  }
): Promise<{ ran: boolean; summary?: EmptyFieldFillSummary }> {
  const statePath = options?.stateFilePath ?? defaultDailyStatePath();
  const intervalMs = options?.intervalMs ?? parseDailyIntervalMs();
  const now = Date.now();
  const last = readLastDailyRunMs(statePath);
  const elapsed = now - last;

  if (elapsed < intervalMs) {
    const waitMs = intervalMs - elapsed;
    if (!options?.quiet) {
      const hours = Math.ceil(waitMs / 3_600_000);
      console.log(
        `[Maktaba] Daily fill skipped (${Math.round(waitMs / 60_000)} min until next run; ~${hours}h)`
      );
    }
    return { ran: false };
  }

  const summary = await fillEmptyBookFieldsFromIsbnOnce(notion, databaseId, {
    quietWhenEmpty: options?.quiet,
    skipRateLimitDelay: options?.skipRateLimitDelay,
  });
  writeLastDailyRunMs(statePath);
  return { ran: true, summary };
}

/**
 * One pass: find pages with ISBN set, fetch from Google Books, update when data differs.
 */
export async function enrichDatabaseOnce(
  notion: Client,
  databaseId: string,
  options?: { quietWhenEmpty?: boolean }
): Promise<EnrichSummary> {
  const quietWhenEmpty = options?.quietWhenEmpty ?? false;

  if (!quietWhenEmpty) {
    console.log(
      `[Maktaba] Querying database ${databaseId} for rows with ISBN (sync if needed)…`
    );
  }

  const pages = await queryPagesToEnrich(notion, databaseId);

  if (pages.length === 0) {
    if (!quietWhenEmpty) {
      console.log("[Maktaba] No pages to enrich. All done.");
    }
    return { enriched: 0, skipped: 0, failed: 0, duplicates: 0 };
  }

  if (!quietWhenEmpty) {
    console.log(`[Maktaba] Found ${pages.length} page(s) to process.\n`);
  }

  const byNormIsbn = groupPageIdsByNormalizedIsbn(pages);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;
  let duplicates = 0;

  for (const page of pages) {
    const pageId = page.id;
    const rawIsbn = extractIsbn(page);

    if (!rawIsbn) {
      console.warn(`[${pageId}] Could not read ISBN property — skipping.`);
      skipped++;
      continue;
    }

    const norm = normalizeIsbn(rawIsbn);
    if (norm) {
      const group = byNormIsbn.get(norm);
      if (group && group.length > 1) {
        const canonical = canonicalPageIdForIsbnGroup(group);
        if (pageId !== canonical) {
          console.warn(
            `[${pageId}] ISBN: ${rawIsbn}  → duplicate of ${canonical} (${norm}). Skipping.\n`
          );
          duplicates++;
          continue;
        }
      }
    }

    console.log(`[${pageId}] ISBN: ${rawIsbn}`);

    const book = await fetchBookByIsbn(rawIsbn);

    if (!book) {
      console.warn(`  → No book data found. Skipping update.\n`);
      skipped++;
      continue;
    }

    console.log(
      `  → Found: "${book.title}" by ${book.authors.join(", ") || "Unknown"}`
    );

    if (!pageMetadataDiffersFromBook(page, book)) {
      console.log(`  → Already matches API. Skipping.\n`);
      skipped++;
      continue;
    }

    try {
      await updatePageFromBook(notion, pageId, book, { page });
      console.log(`  → Updated successfully.\n`);
      enriched++;
    } catch {
      console.error(`  → Update failed. Moving on.\n`);
      failed++;
    }
  }

  if (!quietWhenEmpty) {
    console.log("─".repeat(50));
    console.log(
      `[Maktaba] Done.  Enriched: ${enriched}  |  Skipped: ${skipped}  |  Duplicates: ${duplicates}  |  Failed: ${failed}`
    );
  }

  return { enriched, skipped, failed, duplicates };
}
