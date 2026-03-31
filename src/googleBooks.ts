import axios from "axios";
import { normalizeIsbn } from "./isbn.js";

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

export interface BookInfo {
  title: string;
  authors: string[];
  description: string;
  thumbnailUrl: string | null;
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
      description: info.description ?? "",
      thumbnailUrl,
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
  imageLinks?: {
    thumbnail?: string;
  };
}
