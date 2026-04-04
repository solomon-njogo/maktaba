import {
  getBookById as getBookByIdBackend,
  listBooks as listBooksBackend,
  patchBookReading as patchBookReadingBackend,
} from '@/backend/db/books';
import type { BookReadingPatch } from '@/backend/db/books';

export async function listBooks() {
  return listBooksBackend();
}

export async function getBookById(id: string) {
  return getBookByIdBackend(id);
}

export async function patchBookReading(id: string, patch: BookReadingPatch) {
  return patchBookReadingBackend(id, patch);
}

export type { BookReadingPatch };
