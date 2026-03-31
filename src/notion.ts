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

/**
 * Writes Google Books data into Name, Author, Genre (multi-select), Type (select), ISBN when the API returns one.
 * Does not touch Status, Started, Completed, or Borrowed. 300ms delay after update for rate limits.
 */
export async function updatePageFromBook(
  notion: Client,
  pageId: string,
  book: BookInfo
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

  if (book.genres.length > 0) {
    properties.Genre = {
      multi_select: book.genres.map((name) => ({ name })),
    };
  }

  if (book.typeLabel) {
    properties.Type = {
      select: { name: book.typeLabel },
    };
  }

  if (book.normalizedIsbnFromApi) {
    properties.ISBN = {
      rich_text: [{ text: { content: book.normalizedIsbnFromApi } }],
    };
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      icon: book.thumbnailUrl
        ? { type: "external", external: { url: book.thumbnailUrl } }
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
    await delay(DELAY_MS);
  }
}

