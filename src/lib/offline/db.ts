import { openDB, type DBSchema, type IDBPDatabase } from "idb"

import type { LocalBook, OutboxOp } from "./types"

const DB_NAME = "maktaba"
const DB_VERSION = 1

interface MaktabaDb extends DBSchema {
  books: {
    key: string
    value: LocalBook
  }
  outbox: {
    key: string
    value: OutboxOp
    indexes: { "by-createdAt": number }
  }
  meta: {
    key: string
    value: { key: string; value: number | string }
  }
}

let dbPromise: Promise<IDBPDatabase<MaktabaDb>> | null = null

export function getDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available.")
  }
  if (!dbPromise) {
    dbPromise = openDB<MaktabaDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("books")) {
          db.createObjectStore("books", { keyPath: "ISBN" })
        }
        if (!db.objectStoreNames.contains("outbox")) {
          const outbox = db.createObjectStore("outbox", { keyPath: "id" })
          outbox.createIndex("by-createdAt", "createdAt")
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" })
        }
      },
    })
  }
  return dbPromise
}

export async function getAllBooks(): Promise<LocalBook[]> {
  const db = await getDb()
  return db.getAll("books")
}

export async function getBookByIsbn(isbn: string): Promise<LocalBook | undefined> {
  const db = await getDb()
  return db.get("books", isbn)
}

export async function putBook(book: LocalBook): Promise<void> {
  if (!book.ISBN) return
  const db = await getDb()
  await db.put("books", book)
}

export async function deleteBookRecord(isbn: string): Promise<void> {
  const db = await getDb()
  await db.delete("books", isbn)
}

export async function getOutbox(): Promise<OutboxOp[]> {
  const db = await getDb()
  return db.getAllFromIndex("outbox", "by-createdAt")
}

export async function addOutboxOp(op: OutboxOp): Promise<void> {
  const db = await getDb()
  await db.add("outbox", op)
}

export async function removeOutboxOp(id: string): Promise<void> {
  const db = await getDb()
  await db.delete("outbox", id)
}

export async function isbnHasOtherOps(isbn: string, exceptId: string): Promise<boolean> {
  const ops = await getOutbox()
  return ops.some((op) => op.isbn === isbn && op.id !== exceptId)
}

export async function pendingIsbnSet(): Promise<Set<string>> {
  const ops = await getOutbox()
  return new Set(ops.map((op) => op.isbn))
}

export async function getLastSyncedAt(): Promise<number | undefined> {
  const db = await getDb()
  const row = await db.get("meta", "lastSyncedAt")
  return typeof row?.value === "number" ? row.value : undefined
}

export async function setLastSyncedAt(value: number): Promise<void> {
  const db = await getDb()
  await db.put("meta", { key: "lastSyncedAt", value })
}
