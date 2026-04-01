export type OpenLibraryBook = {
  isbn: string;
  title: string;
  subtitle?: string;
  authors: string[];
  publishDate?: string;
  numberOfPages?: number;
  coverUrl?: string;
  description?: string;
  openLibraryUrl?: string;
};

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
    description?: string | { value?: string };
  }
>;

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

  const desc =
    typeof raw.description === 'string'
      ? raw.description
      : raw.description && typeof raw.description === 'object'
        ? raw.description.value
        : undefined;

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
    openLibraryUrl: raw.url ? `https://openlibrary.org${raw.url}` : undefined,
  };

  return book;
}

