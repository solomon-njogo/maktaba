export type OpenLibraryBook = {
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publishDate?: string;
  numberOfPages?: number;
  coverUrl?: string;
  description?: string;
  /** Top subject labels from Open Library (comma-separated when stored as genre). */
  genre?: string;
  openLibraryUrl?: string;
};

type OpenLibrarySubject = string | { name?: string };

type OpenLibraryResponse = Record<
  string,
  {
    title?: string;
    subtitle?: string;
    authors?: Array<{ name?: string }>;
    publish_date?: string;
    number_of_pages?: number;
    cover?: { small?: string; medium?: string; large?: string };
    url?: string;
    description?: string | { value?: string; type?: string };
    subjects?: OpenLibrarySubject[];
    excerpts?: Array<{ text?: string; comment?: string }>;
  }
>;

const MAX_DESCRIPTION_LENGTH = 12000;

function normalizeDescriptionField(desc: unknown): string | undefined {
  if (typeof desc === 'string') {
    const t = desc.trim();
    return t || undefined;
  }
  if (desc && typeof desc === 'object' && 'value' in desc && typeof (desc as { value?: unknown }).value === 'string') {
    const t = (desc as { value: string }).value.trim();
    return t || undefined;
  }
  return undefined;
}

function trimDescription(text: string): string {
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}

/** When the books API omits description, Open Library often has it on the edition or work JSON. */
async function fetchDescriptionFallback(isbn: string, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const edRes = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, { signal });
    if (!edRes.ok) return undefined;
    const edition = (await edRes.json()) as {
      description?: string | { value?: string };
      works?: Array<{ key?: string }>;
    };

    let text = normalizeDescriptionField(edition.description);
    if (text) return trimDescription(text);

    const workKey = edition.works?.[0]?.key;
    if (!workKey || !workKey.startsWith('/')) return undefined;

    const wRes = await fetch(`https://openlibrary.org${workKey}.json`, { signal });
    if (!wRes.ok) return undefined;
    const work = (await wRes.json()) as { description?: string | { value?: string } };
    text = normalizeDescriptionField(work.description);
    return text ? trimDescription(text) : undefined;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return undefined;
  }
}

function firstExcerptText(raw: { excerpts?: Array<{ text?: string }> } | undefined): string | undefined {
  const t = raw?.excerpts?.[0]?.text?.trim();
  return t || undefined;
}

const MAX_GENRE_SUBJECTS = 5;
const MAX_GENRE_LENGTH = 400;

function subjectsToGenre(subjects: OpenLibrarySubject[] | undefined): string | undefined {
  if (!subjects?.length) return undefined;
  const parts: string[] = [];
  for (const s of subjects) {
    const label = typeof s === 'string' ? s.trim() : typeof s?.name === 'string' ? s.name.trim() : '';
    if (label) parts.push(label);
    if (parts.length >= MAX_GENRE_SUBJECTS) break;
  }
  if (!parts.length) return undefined;
  let out = parts.join(', ');
  if (out.length > MAX_GENRE_LENGTH) out = `${out.slice(0, MAX_GENRE_LENGTH - 1)}…`;
  return out;
}

export async function fetchBookByIsbn(isbn: string, { signal }: { signal?: AbortSignal } = {}) {
  const url = new URL('https://openlibrary.org/api/books');
  url.searchParams.set('bibkeys', `ISBN:${isbn}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('jscmd', 'data');

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) {
    throw new Error(`OpenLibraryError:${res.status}`);
  }

  const json = (await res.json()) as OpenLibraryResponse;
  const key = `ISBN:${isbn}`;
  const raw = json[key];
  if (!raw || !raw.title) return null;

  let desc = normalizeDescriptionField(raw.description);
  if (!desc) {
    desc = await fetchDescriptionFallback(isbn, signal);
  }
  if (!desc) {
    const ex = firstExcerptText(raw);
    if (ex) desc = trimDescription(ex);
  }

  const coverUrl = raw.cover?.large ?? raw.cover?.medium ?? raw.cover?.small;

  const book: OpenLibraryBook = {
    isbn,
    title: raw.title,
    subtitle: raw.subtitle,
    authors: (raw.authors ?? []).map((a) => a.name).filter((x): x is string => Boolean(x)),
    publishDate: raw.publish_date,
    numberOfPages: raw.number_of_pages,
    coverUrl,
    description: desc,
    genre: subjectsToGenre(raw.subjects),
    openLibraryUrl: raw.url ? `https://openlibrary.org${raw.url}` : undefined,
  };

  return book;
}

