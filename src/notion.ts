import { Client, isNotionClientError, isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints.js";
import type { BookInfo } from "./googleBooks.js";

const DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Returns all pages in the given database where:
 *   - ISBN (rich text) is not empty
 *   - Name / Title is empty
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
    and: [
      {
        property: "ISBN",
        rich_text: { is_not_empty: true },
      },
      {
        property: "Name",
        title: { is_empty: true },
      },
    ],
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

// ─── Update page ──────────────────────────────────────────────────────────────

const MAX_RICH_TEXT = 2000;

/**
 * Updates a Notion page with metadata from Google Books.
 * Applies a 300ms delay after the update to respect Notion rate limits.
 */
export async function updatePageFromBook(
  notion: Client,
  pageId: string,
  book: BookInfo
): Promise<void> {
  const description =
    book.description.length > MAX_RICH_TEXT
      ? book.description.slice(0, MAX_RICH_TEXT - 1) + "…"
      : book.description;

  const authorText = book.authors.join(", ");

  try {
    await notion.pages.update({
      page_id: pageId,
      icon: book.thumbnailUrl
        ? { type: "external", external: { url: book.thumbnailUrl } }
        : undefined,
      properties: {
        Name: {
          title: [{ text: { content: book.title } }],
        },
        Author: {
          rich_text: [{ text: { content: authorText } }],
        },
        Summary: {
          rich_text: [{ text: { content: description } }],
        },
      },
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
    await delay(DELAY_MS);
  }
}

