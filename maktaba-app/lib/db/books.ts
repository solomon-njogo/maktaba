import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { books, type BookStatus } from '@/lib/db/schema';

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

export async function setBorrowed(id: string, borrowed: boolean, { startDate, endDate }: { startDate?: number | null; endDate?: number | null } = {}) {
  const db = await getDb();
  await db
    .update(books)
    .set({
      borrowed,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      updatedAt: Date.now(),
    })
    .where(eq(books.id, id));
}

