import { addBook } from './db/books';
import type { OpenLibraryBook } from './openlibrary';

export function newBookId() {
  return typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `book_${Date.now()}`;
}

export type SaveOpenLibraryResult = 'saved' | 'duplicate_db';

export async function saveOpenLibraryBook(book: OpenLibraryBook): Promise<SaveOpenLibraryResult> {
  const id = newBookId();
  try {
    await addBook({
      id,
      isbn: book.isbn,
      title: book.subtitle ? `${book.title}: ${book.subtitle}` : book.title,
      author: book.authors?.length ? book.authors.join(', ') : null,
      pages: book.numberOfPages ?? null,
      description: book.description ?? null,
      genre: book.genre ?? null,
      coverUri: book.coverUrl ?? null,
      status: 'tbr',
    });
    return 'saved';
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint')) {
      return 'duplicate_db';
    }
    throw e;
  }
}
