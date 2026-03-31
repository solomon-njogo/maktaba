import axios from "axios";
import { normalizeIsbn } from "./isbn.js";

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

const NOTION_SELECT_NAME_MAX = 100;

export interface BookInfo {
  title: string;
  authors: string[];
  thumbnailUrl: string | null;
  /** Tags for Notion Genre (multi-select); from volume categories. */
  genres: string[];
  /** Label for Notion Type (select); from printType. */
  typeLabel: string | null;
  /** Normalized ISBN from volume metadata when available (else null). */
  normalizedIsbnFromApi: string | null;
}

function clampSelectName(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.length <= NOTION_SELECT_NAME_MAX
    ? t
    : t.slice(0, NOTION_SELECT_NAME_MAX);
}

/** Split Google Books category strings into distinct genre tags for Notion. */
function genresFromCategories(categories?: string[]): string[] {
  if (!categories?.length) return [];
  const tags = new Set<string>();
  for (const c of categories) {
    for (const part of c.split(/\s*[/&|,]+\s*/)) {
      const name = clampSelectName(part);
      if (name) tags.add(name);
    }
  }
  return [...tags].slice(0, 10);
}

function typeLabelFromPrintType(printType?: string): string | null {
  if (!printType) return null;
  switch (printType) {
    case "BOOK":
      return "Book";
    case "MAGAZINE":
      return "Magazine";
    default:
      return clampSelectName(printType);
  }
}

function pickNormalizedIsbnFromVolume(info: VolumeInfo): string | null {
  const ids = info.industryIdentifiers;
  if (!ids?.length) return null;
  const isbn13 = ids.find((x) => x.type === "ISBN_13")?.identifier;
  const isbn10 = ids.find((x) => x.type === "ISBN_10")?.identifier;
  const raw = isbn13 ?? isbn10;
  return raw ? normalizeIsbn(raw) : null;
}

/**
 * Fetches book metadata from the Google Books API for a given raw ISBN string.
 *
 * Returns null if:
 *  - the ISBN is invalid (non-numeric, wrong length)
 *  - no volumes are returned
 *  - a network or API error occurs
 */
export async function fetchBookByIsbn(rawIsbn: string): Promise<BookInfo | null> {
  const isbn = normalizeIsbn(rawIsbn);

  if (!isbn) {
    console.warn(`  [GoogleBooks] Skipping — invalid ISBN format: "${rawIsbn}"`);
    return null;
  }

  try {
    const params: Record<string, string> = { q: `isbn:${isbn}` };

    const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
    if (apiKey) {
      params.key = apiKey;
    }

    const response = await axios.get<GoogleBooksResponse>(GOOGLE_BOOKS_URL, {
      params,
      timeout: 10_000,
    });

    const items = response.data.items;
    if (!items || items.length === 0) {
      console.warn(`  [GoogleBooks] No results for ISBN: ${isbn}`);
      return null;
    }

    const info = items[0].volumeInfo;

    const rawThumbnail = info.imageLinks?.thumbnail ?? null;
    const thumbnailUrl = rawThumbnail
      ? rawThumbnail.replace(/^http:\/\//, "https://")
      : null;

    return {
      title: info.title ?? "",
      authors: info.authors ?? [],
      thumbnailUrl,
      genres: genresFromCategories(info.categories),
      typeLabel: typeLabelFromPrintType(info.printType),
      normalizedIsbnFromApi: pickNormalizedIsbnFromVolume(info),
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(
        `  [GoogleBooks] HTTP error for ISBN ${isbn}: ${err.response?.status ?? err.message}`
      );
    } else {
      console.error(`  [GoogleBooks] Unexpected error for ISBN ${isbn}:`, err);
    }
    return null;
  }
}

// ─── Google Books API response shape (minimal) ───────────────────────────────

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
}

interface GoogleBooksItem {
  volumeInfo: VolumeInfo;
}

interface VolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  categories?: string[];
  printType?: string;
  industryIdentifiers?: { type: string; identifier: string }[];
  imageLinks?: {
    thumbnail?: string;
  };
}
