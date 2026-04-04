import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite/driver';

let dbPromise: Promise<ReturnType<typeof drizzle>> | null = null;

async function ensureSchema(rawDb: SQLite.SQLiteDatabase) {
  // Pragmas (safe to run repeatedly)
  await rawDb.execAsync('PRAGMA foreign_keys = ON;');
  await rawDb.execAsync('PRAGMA journal_mode = WAL;');

  // Tables
  await rawDb.execAsync(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY NOT NULL,
      cover_uri TEXT,
      author TEXT,
      title TEXT NOT NULL,
      description TEXT,
      isbn TEXT,
      genre TEXT,
      pages INTEGER,
      status TEXT NOT NULL DEFAULT 'tbr',
      borrowed INTEGER NOT NULL DEFAULT 0,
      start_date INTEGER,
      end_date INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Indexes
  await rawDb.execAsync(`CREATE UNIQUE INDEX IF NOT EXISTS books_isbn_unique ON books(isbn);`);

  const cols = await rawDb.getAllAsync<{ name: string }>('PRAGMA table_info(books);');
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('borrowed_by')) {
    await rawDb.execAsync('ALTER TABLE books ADD COLUMN borrowed_by TEXT;');
  }
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const rawDb = await SQLite.openDatabaseAsync('maktaba.db');
      await ensureSchema(rawDb);
      return drizzle(rawDb);
    })();
  }

  return dbPromise;
}
