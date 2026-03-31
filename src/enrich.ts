import { type Client, isFullPage } from "@notionhq/client";
import { queryPagesToEnrich, extractIsbn, updatePageFromBook } from "./notion.js";
import { fetchBookByIsbn } from "./googleBooks.js";

function normalizeNotionId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function isNameEmptyProperty(page: { properties: Record<string, unknown> }): boolean {
  const prop = page.properties["Name"];
  if (!prop || typeof prop !== "object" || !("type" in prop)) return true;
  const p = prop as { type: string; title?: { plain_text: string }[] };
  if (p.type !== "title") return true;
  return !p.title?.some((t) => t.plain_text.trim().length > 0);
}

export type TryEnrichPageResult =
  | "enriched"
  | "skipped"
  | "failed"
  | "not_applicable";

/**
 * Fetches one page by id. If it belongs to databaseId, has ISBN, and Name is empty,
 * looks up Google Books and updates the row.
 */
export async function tryEnrichPageById(
  notion: Client,
  databaseId: string,
  pageId: string
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

  if (!isNameEmptyProperty(page)) return "not_applicable";

  const rawIsbn = extractIsbn(page);
  if (!rawIsbn) return "skipped";

  const book = await fetchBookByIsbn(rawIsbn);
  if (!book) return "skipped";

  try {
    await updatePageFromBook(notion, pageId, book);
    return "enriched";
  } catch {
    return "failed";
  }
}

export interface EnrichSummary {
  enriched: number;
  skipped: number;
  failed: number;
}

/**
 * One pass: find pages with ISBN set and empty Name, fetch from Google Books, update Notion.
 */
export async function enrichDatabaseOnce(
  notion: Client,
  databaseId: string,
  options?: { quietWhenEmpty?: boolean }
): Promise<EnrichSummary> {
  const quietWhenEmpty = options?.quietWhenEmpty ?? false;

  if (!quietWhenEmpty) {
    console.log(
      `[Maktaba] Querying database ${databaseId} for unenriched entries…`
    );
  }

  const pages = await queryPagesToEnrich(notion, databaseId);

  if (pages.length === 0) {
    if (!quietWhenEmpty) {
      console.log("[Maktaba] No pages to enrich. All done.");
    }
    return { enriched: 0, skipped: 0, failed: 0 };
  }

  if (!quietWhenEmpty) {
    console.log(`[Maktaba] Found ${pages.length} page(s) to process.\n`);
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const page of pages) {
    const pageId = page.id;
    const rawIsbn = extractIsbn(page);

    if (!rawIsbn) {
      console.warn(`[${pageId}] Could not read ISBN property — skipping.`);
      skipped++;
      continue;
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

    try {
      await updatePageFromBook(notion, pageId, book);
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
      `[Maktaba] Done.  Enriched: ${enriched}  |  Skipped: ${skipped}  |  Failed: ${failed}`
    );
  }

  return { enriched, skipped, failed };
}
