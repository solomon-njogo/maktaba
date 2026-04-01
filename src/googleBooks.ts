import axios from "axios";
import { normalizeIsbn } from "./isbn.js";

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

const NOTION_SELECT_NAME_MAX = 100;

const GOOGLE_BOOKS_MAX_ATTEMPTS = 5;
const GOOGLE_BOOKS_BASE_BACKOFF_MS = 1_500;

/** Avoid repeated lookups when Notion sends multiple webhooks for the same row. */
const BOOK_CACHE_TTL_MS = 5 * 60_000;
const bookCache = new Map<
  string,
  { expires: number; value: BookInfo | null }
>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse Retry-After: seconds (number) or HTTP-date. Returns ms to wait, or null. */
function retryAfterMs(header: string | undefined): number | null {
  if (!header?.trim()) return null;
  const sec = Number(header);
  if (!Number.isNaN(sec) && sec >= 0) return Math.min(sec * 1000, 120_000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? Math.min(delta, 120_000) : null;
  }
  return null;
}

export interface BookInfo {
  title: string;
  authors: string[];
  /** Small image; used for Notion page icon. */
  thumbnailUrl: string | null;
  /** Larger banner-friendly URL for Notion page cover (Google Books `zoom=0` when applicable). */
  coverUrl: string | null;
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

function toHttps(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

/** Prefer higher resolution for Notion cover (Google uses `zoom=` in many image URLs). */
function googleBooksCoverUrlFromRaw(raw: string): string {
  const https = toHttps(raw);
  if (/zoom=\d+/i.test(https)) {
    return https.replace(/zoom=\d+/i, "zoom=0");
  }
  return https;
}

type ImageLinks = NonNullable<VolumeInfo["imageLinks"]>;

/** Largest available art for Notion cover / Files & media (better preview than zoom=1 thumbs). */
function pickLargestImageRaw(links?: ImageLinks): string | null {
  if (!links) return null;
  const order = [
    links.extraLarge,
    links.large,
    links.medium,
    links.small,
    links.thumbnail,
    links.smallThumbnail,
  ];
  for (const u of order) {
    if (u?.trim()) return u;
  }
  return null;
}

/** Smaller URL for page icon when Google exposes separate sizes. */
function pickSmallestImageRaw(links?: ImageLinks): string | null {
  if (!links) return null;
  const order = [
    links.smallThumbnail,
    links.thumbnail,
    links.small,
    links.medium,
    links.large,
    links.extraLarge,
  ];
  for (const u of order) {
    if (u?.trim()) return u;
  }
  return null;
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

  const now = Date.now();
  const cached = bookCache.get(isbn);
  if (cached && cached.expires > now) {
    return cached.value;
  }

  const params: Record<string, string> = { q: `isbn:${isbn}` };
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    params.key = apiKey;
  }

  for (let attempt = 1; attempt <= GOOGLE_BOOKS_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.get<GoogleBooksResponse>(GOOGLE_BOOKS_URL, {
        params,
        timeout: 10_000,
      });

      const items = response.data.items;
      if (!items || items.length === 0) {
        console.warn(`  [GoogleBooks] No results for ISBN: ${isbn}`);
        bookCache.set(isbn, { expires: Date.now() + 60_000, value: null });
        return null;
      }

      const info = items[0].volumeInfo;

      const links = info.imageLinks;
      const thumbRaw = pickSmallestImageRaw(links);
      const coverRaw = pickLargestImageRaw(links) ?? thumbRaw;
      const thumbnailUrl = thumbRaw ? toHttps(thumbRaw) : null;
      const coverUrl = coverRaw ? googleBooksCoverUrlFromRaw(coverRaw) : null;

      const book: BookInfo = {
        title: info.title ?? "",
        authors: info.authors ?? [],
        thumbnailUrl,
        coverUrl,
        genres: genresFromCategories(info.categories),
        typeLabel: typeLabelFromPrintType(info.printType),
        normalizedIsbnFromApi: pickNormalizedIsbnFromVolume(info),
      };
      bookCache.set(isbn, {
        expires: Date.now() + BOOK_CACHE_TTL_MS,
        value: book,
      });
      return book;
    } catch (err) {
      if (!axios.isAxiosError(err)) {
        console.error(`  [GoogleBooks] Unexpected error for ISBN ${isbn}:`, err);
        bookCache.set(isbn, { expires: Date.now() + 30_000, value: null });
        return null;
      }

      const status = err.response?.status;
      const retryable =
        status === 429 ||
        status === 503 ||
        status === 502 ||
        (status !== undefined && status >= 500);

      if (!retryable || attempt === GOOGLE_BOOKS_MAX_ATTEMPTS) {
        console.error(
          `  [GoogleBooks] HTTP error for ISBN ${isbn}: ${status ?? err.message}`
        );
        bookCache.set(isbn, { expires: Date.now() + 30_000, value: null });
        return null;
      }

      const retryAfterHeader = err.response?.headers?.["retry-after"];
      const fromHeader = retryAfterMs(
        typeof retryAfterHeader === "string" ? retryAfterHeader : undefined
      );
      const backoff =
        fromHeader ??
        Math.min(GOOGLE_BOOKS_BASE_BACKOFF_MS * 2 ** (attempt - 1), 30_000);
      console.warn(
        `  [GoogleBooks] ${status} for ISBN ${isbn} — retry ${attempt}/${GOOGLE_BOOKS_MAX_ATTEMPTS} in ${Math.round(backoff / 1000)}s`
      );
      await sleep(backoff);
    }
  }

  return null;
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
    smallThumbnail?: string;
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
  };
}
