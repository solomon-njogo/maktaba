import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export type BookStatus = 'buy' | 'tbr' | 'read';

export const books = sqliteTable(
  'books',
  {
    id: text('id').primaryKey(), // app-generated (e.g. crypto.randomUUID())

    coverUri: text('cover_uri'), // local file URI or remote URL
    author: text('author'),
    title: text('title').notNull(),
    description: text('description'),
    isbn: text('isbn'),
    genre: text('genre'),
    pages: integer('pages'),
    status: text('status').$type<BookStatus>().notNull().default('tbr'),

    borrowed: integer('borrowed', { mode: 'boolean' }).notNull().default(false),
    startDate: integer('start_date'), // stored as epoch ms (nullable)
    endDate: integer('end_date'), // stored as epoch ms (nullable)

    createdAt: integer('created_at').notNull(), // epoch ms
    updatedAt: integer('updated_at').notNull(), // epoch ms
  },
  (table) => ({
    isbnUnique: uniqueIndex('books_isbn_unique').on(table.isbn),
  })
);

