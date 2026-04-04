import { eq } from 'drizzle-orm';

import { getDb } from './index';
import { books, type BookStatus } from './schema';

export type NewBookInput = {
  id: string;
  coverUri?: string | null;
  author?: string | null;
  title: string;
  description?: string | null;
  isbn?: string | null;
  genre?: string | null;
  pages?: number | null;
  status?: BookStatus | null;
  borrowed?: boolean | null;
  borrowedBy?: string | null;
  startDate?: number | null; // epoch ms
  endDate?: number | null; // epoch ms
};

export async function addBook(input: NewBookInput) {
  const db = await getDb();
  const now = Date.now();

  await db.insert(books).values({
    id: input.id,
    coverUri: input.coverUri ?? null,
    author: input.author ?? null,
    title: input.title,
    description: input.description ?? null,
    isbn: input.isbn ?? null,
    genre: input.genre ?? null,
    pages: input.pages ?? null,
    status: (input.status ?? 'tbr') as BookStatus,
    borrowed: input.borrowed ?? false,
    borrowedBy: input.borrowedBy ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listBooks() {
  const db = await getDb();
  return await db.select().from(books).orderBy(books.updatedAt);
}

export async function getBookById(id: string) {
  const db = await getDb();
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] ?? null;
}

/** Partial update for fields fetched from Open Library (backfill / refresh). */
export type BookMetadataPatch = Partial<{
  description: string | null;
  genre: string | null;
  pages: number | null;
  coverUri: string | null;
  author: string | null;
}>;

export async function updateBookMetadata(id: string, patch: BookMetadataPatch) {
  const db = await getDb();
  const updates: Partial<typeof books.$inferInsert> = { updatedAt: Date.now() };
  let hasField = false;
  for (const k of Object.keys(patch) as (keyof BookMetadataPatch)[]) {
    const v = patch[k];
    if (v !== undefined) {
      (updates as Record<string, unknown>)[k] = v;
      hasField = true;
    }
  }
  if (!hasField) return;

  await db.update(books).set(updates).where(eq(books.id, id));
}

export async function updateBookStatus(id: string, status: BookStatus) {
  const db = await getDb();
  await db
    .update(books)
    .set({ status, updatedAt: Date.now() })
    .where(eq(books.id, id));
}

export type BookReadingPatch = {
  status?: BookStatus;
  borrowed?: boolean;
  borrowedBy?: string | null;
  startDate?: number | null;
  endDate?: number | null;
};

/** Applies partial updates; turning `borrowed` off clears borrower name and loan dates. */
export async function patchBookReading(id: string, patch: BookReadingPatch) {
  const db = await getDb();
  const rows = await db.select().from(books).where(eq(books.id, id)).limit(1);
  const current = rows[0];
  if (!current) return;

  let status = current.status;
  let borrowed = current.borrowed;
  let borrowedBy = current.borrowedBy ?? null;
  let startDate = current.startDate ?? null;
  let endDate = current.endDate ?? null;

  if (patch.status !== undefined) status = patch.status;

  if (patch.borrowed === false) {
    borrowed = false;
    borrowedBy = null;
    startDate = null;
    endDate = null;
  } else {
    if (patch.borrowed === true) borrowed = true;
    if (patch.borrowedBy !== undefined) borrowedBy = patch.borrowedBy?.trim() ? patch.borrowedBy.trim() : null;
    if (patch.startDate !== undefined) startDate = patch.startDate;
    if (patch.endDate !== undefined) endDate = patch.endDate;
  }

  await db
    .update(books)
    .set({
      status,
      borrowed,
      borrowedBy,
      startDate,
      endDate,
      updatedAt: Date.now(),
    })
    .where(eq(books.id, id));
}

export async function setBorrowed(
  id: string,
  borrowed: boolean,
  { startDate, endDate, borrowedBy }: { startDate?: number | null; endDate?: number | null; borrowedBy?: string | null } = {}
) {
  if (!borrowed) {
    await patchBookReading(id, { borrowed: false });
    return;
  }
  await patchBookReading(id, {
    borrowed: true,
    ...(startDate !== undefined ? { startDate } : {}),
    ...(endDate !== undefined ? { endDate } : {}),
    ...(borrowedBy !== undefined ? { borrowedBy } : {}),
  });
}
