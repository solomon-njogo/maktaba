import { Client, isNotionClientError, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints.js";
import type { BookInfo } from "./googleBooks.js";
import { normalizeIsbn } from "./isbn.js";

const DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Returns all pages in the given database where ISBN (rich text) is not empty.
 * Rows are compared to Google Books; updates run when metadata differs or fields are empty.
 *
 * Handles Notion's cursor-based pagination automatically.
 */
export async function queryPagesToEnrich(
  notion: Client,
  databaseId: string
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  const filter: QueryDatabaseParameters["filter"] = {
    property: "ISBN",
    rich_text: { is_not_empty: true },
  };

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const result of response.results) {
      if (isFullPage(result)) {
        pages.push(result);
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}

// ─── Extract ISBN from a page ─────────────────────────────────────────────────

/**
 * Reads the plain-text value of the "ISBN" rich_text property from a page.
 * Returns null if the property is missing or empty.
 */
export function extractIsbn(page: PageObjectResponse): string | null {
  const prop = page.properties["ISBN"];
  if (!prop || prop.type !== "rich_text") return null;

  const text = prop.rich_text.map((rt) => rt.plain_text).join("").trim();
  return text.length > 0 ? text : null;
}

/**
 * Groups page ids by normalized ISBN (invalid/missing normalization omitted).
 */
export function groupPageIdsByNormalizedIsbn(
  pages: PageObjectResponse[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of pages) {
    const raw = extractIsbn(p);
    if (!raw) continue;
    const n = normalizeIsbn(raw);
    if (!n) continue;
    const list = map.get(n) ?? [];
    list.push(p.id);
    map.set(n, list);
  }
  return map;
}

/** Stable choice when several rows share the same ISBN (deterministic tie-break). */
export function canonicalPageIdForIsbnGroup(ids: string[]): string {
  return [...ids].sort()[0];
}

/**
 * All database rows whose ISBN normalizes to `targetNorm` (full scan of ISBN rows).
 */
export async function findPageIdsWithSameNormalizedIsbn(
  notion: Client,
  databaseId: string,
  targetNorm: string
): Promise<string[]> {
  const pages = await queryPagesToEnrich(notion, databaseId);
  const ids: string[] = [];
  for (const p of pages) {
    const raw = extractIsbn(p);
    if (!raw) continue;
    if (normalizeIsbn(raw) === targetNorm) ids.push(p.id);
  }
  return ids;
}

function getTitlePlain(page: PageObjectResponse): string {
  const prop = page.properties["Name"];
  if (!prop || prop.type !== "title") return "";
  return prop.title?.map((t) => t.plain_text).join("") ?? "";
}

function getAuthorPlain(page: PageObjectResponse): string {
  const prop = page.properties["Author"];
  if (!prop || prop.type !== "rich_text") return "";
  return prop.rich_text.map((rt) => rt.plain_text).join("").trim();
}

function getGenreNames(page: PageObjectResponse): string[] {
  const prop = page.properties["Genre"];
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((m) => m.name);
}

function getTypeName(page: PageObjectResponse): string | null {
  const prop = page.properties["Type"];
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

function normCompareText(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeComparableImageUrl(url: string): string {
  const u = url.trim().replace(/^http:\/\//i, "https://");
  return u.replace(/zoom=\d+/gi, "zoom=0");
}

/**
 * URL for Notion **Files & media** Thumbnail: prefer high-res cover so the cell shows a real preview (not a tiny zoom=1 strip).
 * Page icon still uses {@link BookInfo.thumbnailUrl} separately.
 */
function thumbnailFilesPropertyUrl(book: BookInfo): string | null {
  return book.coverUrl ?? book.thumbnailUrl ?? null;
}

/**
 * True when the page has no external cover or it does not match the API image.
 * Skips when Notion stores the cover as `file` (signed URLs would thrash on every poll).
 */
function coverNeedsSyncFromBook(
  page: PageObjectResponse,
  coverUrl: string | null
): boolean {
  if (!coverUrl) return false;
  const c = page.cover;
  if (!c) return true;
  if (c.type === "file") return false;
  if (c.type === "external") {
    return (
      normalizeComparableImageUrl(c.external.url) !==
      normalizeComparableImageUrl(coverUrl)
    );
  }
  return true;
}

/** Comparable URL from the Thumbnail DB property (files or url); ignores uploaded `file` entries. */
function getThumbnailComparableUrl(page: PageObjectResponse): string | null {
  const prop = page.properties["Thumbnail"];
  if (!prop) return null;
  if (prop.type === "url") {
    const u = prop.url;
    return u ? normalizeComparableImageUrl(u) : null;
  }
  if (prop.type === "files") {
    for (const f of prop.files) {
      if (f.type === "external") {
        return normalizeComparableImageUrl(f.external.url);
      }
    }
    return null;
  }
  return null;
}

function thumbnailNeedsSyncFromBook(
  page: PageObjectResponse,
  book: BookInfo
): boolean {
  const target = thumbnailFilesPropertyUrl(book);
  if (!target) return false;
  const pageUrl = getThumbnailComparableUrl(page);
  if (!pageUrl) return true;
  return pageUrl !== normalizeComparableImageUrl(target);
}

/**
 * True when visible book fields on the page differ from what the API would write
 * (title, author, genres, type, normalized ISBN when the API provides one, cover image, Thumbnail property).
 */
export function pageMetadataDiffersFromBook(
  page: PageObjectResponse,
  book: BookInfo
): boolean {
  if (normCompareText(getTitlePlain(page)) !== normCompareText(book.title)) {
    return true;
  }

  const authorExpected =
    book.authors.length > 0 ? book.authors.join(", ") : "Unknown";
  if (normCompareText(getAuthorPlain(page)) !== normCompareText(authorExpected)) {
    return true;
  }

  const genresPage = [...getGenreNames(page)].map(normCompareText).sort().join("\u0001");
  const genresBook = [...book.genres].map(normCompareText).sort().join("\u0001");
  if (genresPage !== genresBook) return true;

  const typePage = getTypeName(page);
  const typeBook = book.typeLabel;
  const tPage = typePage ? normCompareText(typePage) : "";
  const tBook = typeBook ? normCompareText(typeBook) : "";
  if (tPage !== tBook) return true;

  const rawIsbn = extractIsbn(page);
  const pageIsbnNorm = rawIsbn ? normalizeIsbn(rawIsbn) : null;
  const apiIsbn = book.normalizedIsbnFromApi;
  if (apiIsbn && pageIsbnNorm !== apiIsbn) return true;

  if (coverNeedsSyncFromBook(page, book.coverUrl)) return true;

  if (thumbnailNeedsSyncFromBook(page, book)) return true;

  return false;
}

// ─── Update page ──────────────────────────────────────────────────────────────

/**
 * Writes Google Books data into Name, Author, Genre (multi-select), Type (select), ISBN when the API returns one.
 * Sets page icon (small thumb), page cover (high-res), and Thumbnail Files & media (high-res when available).
 * Does not touch Status, Started, Completed, or Borrowed. Optional delay after update for bulk rate limits.
 */
export async function updatePageFromBook(
  notion: Client,
  pageId: string,
  book: BookInfo,
  options?: { rateLimitDelayMs?: number; page?: PageObjectResponse }
): Promise<void> {
  const authorText =
    book.authors.length > 0 ? book.authors.join(", ") : "Unknown";

  const properties: Parameters<Client["pages"]["update"]>[0]["properties"] = {
    Name: {
      title: [{ text: { content: book.title } }],
    },
    Author: {
      rich_text: [{ text: { content: authorText } }],
    },
  };

  properties.Genre = {
    multi_select: book.genres.map((name) => ({ name })),
  };

  properties.Type = book.typeLabel
    ? { select: { name: book.typeLabel } }
    : { select: null };

  if (book.normalizedIsbnFromApi) {
    properties.ISBN = {
      rich_text: [{ text: { content: book.normalizedIsbnFromApi } }],
    };
  }

  const thumbFileUrl = thumbnailFilesPropertyUrl(book);
  if (thumbFileUrl) {
    const thumbProp = options?.page?.properties["Thumbnail"];
    if (thumbProp?.type === "url") {
      properties.Thumbnail = { url: thumbFileUrl };
    } else if (!thumbProp || thumbProp.type === "files") {
      properties.Thumbnail = {
        files: [
          {
            type: "external",
            name: "Cover.jpg",
            external: { url: thumbFileUrl },
          },
        ],
      };
    }
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      icon: book.thumbnailUrl
        ? { type: "external", external: { url: book.thumbnailUrl } }
        : undefined,
      cover: book.coverUrl
        ? { type: "external", external: { url: book.coverUrl } }
        : undefined,
      properties,
    });
  } catch (err) {
    if (isNotionClientError(err)) {
      console.error(
        `  [Notion] API error updating page ${pageId}: ${err.message}`
      );
    } else {
      console.error(`  [Notion] Unknown error updating page ${pageId}:`, err);
    }
    throw err;
  } finally {
    const ms = options?.rateLimitDelayMs ?? DELAY_MS;
    if (ms > 0) await delay(ms);
  }
}

// ─── Partial update (empty fields only) ───────────────────────────────────────

export type EmptyFieldsBookPatch = {
  properties: Parameters<Client["pages"]["update"]>[0]["properties"];
  icon?: { type: "external"; external: { url: string } };
  cover?: { type: "external"; external: { url: string } };
};

function isThumbnailPropertyEmpty(page: PageObjectResponse): boolean {
  return getThumbnailComparableUrl(page) === null;
}

/**
 * Builds a Notion pages.update payload that only fills managed fields that are
 * currently empty on the page (Name, Author, Genre, Type, ISBN, Thumbnail, icon, cover).
 * Returns null when nothing needs writing.
 */
export function buildPatchForEmptyBookFieldsOnly(
  page: PageObjectResponse,
  book: BookInfo
): EmptyFieldsBookPatch | null {
  const properties: EmptyFieldsBookPatch["properties"] = {};
  let changed = false;

  if (!getTitlePlain(page).trim() && book.title.trim()) {
    properties.Name = {
      title: [{ text: { content: book.title } }],
    };
    changed = true;
  }

  if (!getAuthorPlain(page).trim()) {
    const authorText =
      book.authors.length > 0 ? book.authors.join(", ") : "Unknown";
    properties.Author = {
      rich_text: [{ text: { content: authorText } }],
    };
    changed = true;
  }

  if (getGenreNames(page).length === 0 && book.genres.length > 0) {
    properties.Genre = {
      multi_select: book.genres.map((name) => ({ name })),
    };
    changed = true;
  }

  if (getTypeName(page) === null && book.typeLabel) {
    properties.Type = { select: { name: book.typeLabel } };
    changed = true;
  }

  const rawIsbn = extractIsbn(page);
  if (!rawIsbn?.trim() && book.normalizedIsbnFromApi) {
    properties.ISBN = {
      rich_text: [{ text: { content: book.normalizedIsbnFromApi } }],
    };
    changed = true;
  }

  let icon: EmptyFieldsBookPatch["icon"];
  let cover: EmptyFieldsBookPatch["cover"];

  const thumbFileUrl = thumbnailFilesPropertyUrl(book);
  if (thumbFileUrl && isThumbnailPropertyEmpty(page)) {
    const thumbProp = page.properties["Thumbnail"];
    if (thumbProp?.type === "url") {
      properties.Thumbnail = { url: thumbFileUrl };
      changed = true;
    } else if (!thumbProp || thumbProp.type === "files") {
      properties.Thumbnail = {
        files: [
          {
            type: "external",
            name: "Cover.jpg",
            external: { url: thumbFileUrl },
          },
        ],
      };
      changed = true;
    }
  }

  if (!page.icon && book.thumbnailUrl) {
    icon = { type: "external", external: { url: book.thumbnailUrl } };
    changed = true;
  }

  if (!page.cover && book.coverUrl) {
    cover = { type: "external", external: { url: book.coverUrl } };
    changed = true;
  }

  if (!changed) return null;

  return { properties, icon, cover };
}

/**
 * Applies {@link buildPatchForEmptyBookFieldsOnly}; returns whether an update was sent.
 */
export async function updatePageFromBookEmptyFieldsOnly(
  notion: Client,
  pageId: string,
  book: BookInfo,
  page: PageObjectResponse,
  options?: { rateLimitDelayMs?: number }
): Promise<boolean> {
  const patch = buildPatchForEmptyBookFieldsOnly(page, book);
  if (!patch) return false;

  const payload: Parameters<Client["pages"]["update"]>[0] = {
    page_id: pageId,
  };
  const props = patch.properties;
  if (props && Object.keys(props).length > 0) {
    payload.properties = props;
  }
  if (patch.icon) payload.icon = patch.icon;
  if (patch.cover) payload.cover = patch.cover;

  try {
    await notion.pages.update(payload);
  } catch (err) {
    if (isNotionClientError(err)) {
      console.error(
        `  [Notion] API error (empty-fields patch) ${pageId}: ${err.message}`
      );
    } else {
      console.error(
        `  [Notion] Unknown error (empty-fields patch) ${pageId}:`,
        err
      );
    }
    throw err;
  } finally {
    const ms = options?.rateLimitDelayMs ?? DELAY_MS;
    if (ms > 0) await delay(ms);
  }

  return true;
}

