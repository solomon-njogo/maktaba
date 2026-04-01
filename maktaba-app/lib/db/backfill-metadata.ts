import { fetchBookByIsbn } from '@/lib/openlibrary';

import { listBooks, updateBookMetadata, type BookMetadataPatch } from '@/lib/db/books';

/**
 * Fetches Open Library data for each book that has an ISBN and fills only columns that are empty.
 * Runs sequentially to stay gentle on the public API. Safe to call on every launch (no network when nothing is missing).
 */
export async function backfillMissingMetadataFromOpenLibrary(opts?: { signal?: AbortSignal }) {
  const { signal } = opts ?? {};
  const rows = await listBooks();

  for (const row of rows) {
    if (signal?.aborted) break;

    const isbn = row.isbn?.trim();
    if (!isbn) continue;

    const missingAuthor = !row.author?.trim();
    const missingDesc = !row.description?.trim();
    const missingGenre = !row.genre?.trim();
    const missingPages = row.pages == null;
    const missingCover = !row.coverUri?.trim();

    if (!missingAuthor && !missingDesc && !missingGenre && !missingPages && !missingCover) continue;

    let data;
    try {
      data = await fetchBookByIsbn(isbn, { signal });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      continue;
    }
    if (!data) continue;

    const patch: BookMetadataPatch = {};
    if (missingAuthor && data.authors?.length) {
      patch.author = data.authors.join(', ');
    }
    if (missingDesc && data.description?.trim()) {
      patch.description = data.description.trim();
    }
    if (missingGenre && data.genre?.trim()) {
      patch.genre = data.genre.trim();
    }
    if (missingPages && data.numberOfPages != null) {
      patch.pages = data.numberOfPages;
    }
    if (missingCover && data.coverUrl?.trim()) {
      patch.coverUri = data.coverUrl.trim();
    }

    if (Object.keys(patch).length === 0) continue;
    await updateBookMetadata(row.id, patch);
  }
}
