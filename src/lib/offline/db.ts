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

export function resetDbConnection(
  expectedPromise?: Promise<IDBPDatabase<MaktabaDb>>
) {
  if (expectedPromise && dbPromise !== expectedPromise) return
  const current = dbPromise
  dbPromise = null
  if (current) {
    void current.then((db) => db.close()).catch(() => {})
  }
}

export function getDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available.")
  }
  if (!dbPromise) {
    const promise = openDB<MaktabaDb>(DB_NAME, DB_VERSION, {
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
      blocking() {
        if (dbPromise === promise) dbPromise = null
      },
      terminated() {
        if (dbPromise === promise) dbPromise = null
      },
    }).then(
      (db) => {
        db.onversionchange = () => {
          db.close()
          if (dbPromise === promise) dbPromise = null
        }
        return db
      },
      (error) => {
        if (dbPromise === promise) dbPromise = null
        throw error
      }
    )
    dbPromise = promise
  }
  return dbPromise
}

function isRecoverableDbError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (error.name === "InvalidStateError") return true
  const msg = error.message || ""
  return (
    /closing|closed|terminated|lost|connection/i.test(msg) &&
    /database|indexeddb|transaction/i.test(msg)
  )
}

async function withDb<T>(
  operation: (db: IDBPDatabase<MaktabaDb>) => Promise<T>
): Promise<T> {
  const attemptPromise = getDb()
  try {
    const db = await attemptPromise
    return await operation(db)
  } catch (error) {
    if (!isRecoverableDbError(error)) throw error
    resetDbConnection(attemptPromise)
    const db = await getDb()
    return await operation(db)
  }
}

export async function getAllBooks(): Promise<LocalBook[]> {
  return withDb((db) => db.getAll("books"))
}

export async function getBookByIsbn(isbn: string): Promise<LocalBook | undefined> {
  return withDb((db) => db.get("books", isbn))
}

export async function putBook(book: LocalBook): Promise<void> {
  if (!book.ISBN) return
  await withDb((db) => db.put("books", book))
}

export async function deleteBookRecord(isbn: string): Promise<void> {
  await withDb((db) => db.delete("books", isbn))
}

export async function commitBookChanges(
  puts: LocalBook[],
  deletes: string[]
): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction("books", "readwrite")
    for (const book of puts) {
      if (!book.ISBN) continue
      await tx.store.put(book)
    }
    for (const isbn of deletes) await tx.store.delete(isbn)
    await tx.done
  })
}

export async function getOutbox(): Promise<OutboxOp[]> {
  return withDb((db) => db.getAllFromIndex("outbox", "by-createdAt"))
}

export async function getOutboxOp(id: string): Promise<OutboxOp | undefined> {
  return withDb((db) => db.get("outbox", id))
}

export async function addOutboxOp(op: OutboxOp): Promise<void> {
  await withDb((db) => db.add("outbox", op))
}

export async function updateOutboxOp(
  id: string,
  updater: (op: OutboxOp) => OutboxOp | null
): Promise<OutboxOp | undefined> {
  return withDb(async (db) => {
    const tx = db.transaction("outbox", "readwrite")
    const existing = await tx.store.get(id)
    if (!existing) {
      await tx.done
      return undefined
    }
    const next = updater(existing)
    if (!next) {
      await tx.store.delete(id)
      await tx.done
      return undefined
    }
    await tx.store.put(next)
    await tx.done
    return next
  })
}

export async function resetOutboxOpsForRetry(opId?: string): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction("outbox", "readwrite")
    if (opId) {
      const op = await tx.store.get(opId)
      if (op) {
        await tx.store.put({
          ...op,
          paused: false,
          nextRetryAt: undefined,
          lastError: undefined,
          lastStatus: undefined,
        })
      }
    } else {
      const ops = await tx.store.index("by-createdAt").getAll()
      for (const op of ops) {
        if (op.paused || op.nextRetryAt || op.lastError || op.lastStatus) {
          await tx.store.put({
            ...op,
            paused: false,
            nextRetryAt: undefined,
            lastError: undefined,
            lastStatus: undefined,
          })
        }
      }
    }
    await tx.done
  })
}

export async function removeOutboxOp(id: string): Promise<void> {
  await withDb((db) => db.delete("outbox", id))
}

export async function clearOutbox(): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction("outbox", "readwrite")
    await tx.store.clear()
    await tx.done
  })
}

export type BookAndOutboxTx = {
  books: {
    get: (isbn: string) => Promise<LocalBook | undefined>
    getAll: () => Promise<LocalBook[]>
    put: (book: LocalBook) => Promise<void>
    delete: (isbn: string) => Promise<void>
  }
  outbox: {
    get: (id: string) => Promise<OutboxOp | undefined>
    getAll: () => Promise<OutboxOp[]>
    put: (op: OutboxOp) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  nextCreatedAt: (currentOps: OutboxOp[]) => number
}

export async function commitBookAndOutbox<T>(
  fn: (tx: BookAndOutboxTx) => Promise<T>
): Promise<T> {
  return withDb(async (db) => {
    const tx = db.transaction(["books", "outbox"], "readwrite")
    const booksStore = tx.objectStore("books")
    const outboxStore = tx.objectStore("outbox")
    try {
      const result = await fn({
        books: {
          get: (isbn) => booksStore.get(isbn),
          getAll: () => booksStore.getAll(),
          put: async (book) => {
            if (!book.ISBN) return
            await booksStore.put(book)
          },
          delete: (isbn) => booksStore.delete(isbn),
        },
        outbox: {
          get: (id) => outboxStore.get(id),
          getAll: () => outboxStore.index("by-createdAt").getAll(),
          put: async (op) => {
            await outboxStore.put(op)
          },
          delete: (id) => outboxStore.delete(id),
        },
        nextCreatedAt: (currentOps) => {
          const maxCreated = currentOps.reduce(
            (max, op) => (op.createdAt > max ? op.createdAt : max),
            0
          )
          return Math.max(Date.now(), maxCreated + 1)
        },
      })
      await tx.done
      return result
    } catch (error) {
      try {
        tx.abort()
      } catch {
        // Transaction may already be finished or aborted.
      }
      await tx.done.catch(() => {})
      throw error
    }
  })
}

export async function replaceOutboxOrder(ids: string[]): Promise<void> {
  await withDb(async (db) => {
    const tx = db.transaction("outbox", "readwrite")
    const current = await tx.store.index("by-createdAt").getAll()
    const byId = new Map(current.map((op) => [op.id, op]))
    const byIsbnQueue = new Map<string, OutboxOp[]>()

    for (const op of current) {
      const list = byIsbnQueue.get(op.isbn) ?? []
      list.push(op)
      byIsbnQueue.set(op.isbn, list)
    }

    const slotIsbns: string[] = []
    for (const id of ids) {
      const op = byId.get(id)
      if (!op) continue
      slotIsbns.push(op.isbn)
      byId.delete(id)
    }
    for (const leftover of byId.values()) {
      slotIsbns.push(leftover.isbn)
    }

    const next: OutboxOp[] = []
    for (const isbn of slotIsbns) {
      const queue = byIsbnQueue.get(isbn)
      const op = queue?.shift()
      if (op) next.push(op)
    }

    const start = Math.max(1, Date.now() - next.length)
    for (let i = 0; i < next.length; i++) {
      const op = next[i]
      await tx.store.put({
        ...op,
        queuedAt: op.queuedAt ?? op.createdAt,
        createdAt: start + i,
      })
    }
    await tx.done
  })
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
  return withDb(async (db) => {
    const row = await db.get("meta", "lastSyncedAt")
    return typeof row?.value === "number" ? row.value : undefined
  })
}

export async function setLastSyncedAt(value: number): Promise<void> {
  await withDb((db) => db.put("meta", { key: "lastSyncedAt", value }))
}
