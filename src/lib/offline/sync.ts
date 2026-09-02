import {
  addBook,
  ApiError,
  getBook,
  listBooks,
  removeBook,
  updateBook,
} from "@/lib/api/books"
import {
  deleteBookRecord,
  getLastSyncedAt,
  getOutbox,
  isbnHasOtherOps,
  pendingIsbnSet,
  removeOutboxOp,
  setLastSyncedAt,
} from "./db"
import { notifyLibrary } from "./events"
import { replaceRemoteCatalog, upsertRemoteBook } from "./books-repository"
import type { SyncStatus } from "./types"

let draining = false
let started = false
let lastError: string | undefined
let syncing = false

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine
}

export function getSyncSnapshot(pendingCount: number, lastSyncedAt?: number): SyncStatus {
  return {
    online: isBrowserOnline(),
    syncing,
    pendingCount,
    lastSyncedAt,
    lastError,
  }
}

export async function readSyncStatus(): Promise<SyncStatus> {
  const pending = await pendingIsbnSet()
  return getSyncSnapshot(pending.size, await getLastSyncedAt())
}

export async function pullRemoteCatalog(): Promise<void> {
  if (!isBrowserOnline()) return
  syncing = true
  notifyLibrary()
  try {
    const remote = await listBooks()
    await replaceRemoteCatalog(remote)
    await setLastSyncedAt(Date.now())
    lastError = undefined
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Could not sync library."
  } finally {
    syncing = false
    notifyLibrary()
  }
}

export async function drainOutbox(): Promise<void> {
  if (draining || !isBrowserOnline()) return
  draining = true
  syncing = true
  notifyLibrary()

  try {
    const ops = await getOutbox()
    for (const op of ops) {
      try {
        if (op.type === "create") {
          const created = await addBook(op.isbn, op.payload)
          await upsertRemoteBook(created, {
            preserveLocal: await isbnHasOtherOps(op.isbn, op.id),
          })
        } else if (op.type === "update") {
          const updated = await updateBook(op.isbn, op.payload ?? {})
          await upsertRemoteBook(updated, {
            preserveLocal: await isbnHasOtherOps(op.isbn, op.id),
          })
        } else {
          await removeBook(op.isbn)
          await deleteBookRecord(op.isbn)
        }
        await removeOutboxOp(op.id)
        lastError = undefined
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && op.type === "create") {
          try {
            const existing = await getBook(op.isbn)
            if (op.payload && Object.keys(op.payload).length > 0) {
              const updated = await updateBook(op.isbn, op.payload)
              await upsertRemoteBook(updated, {
                preserveLocal: await isbnHasOtherOps(op.isbn, op.id),
              })
            } else {
              await upsertRemoteBook(existing, {
                preserveLocal: await isbnHasOtherOps(op.isbn, op.id),
              })
            }
            await removeOutboxOp(op.id)
            lastError = undefined
            continue
          } catch (inner) {
            lastError =
              inner instanceof Error ? inner.message : "Could not merge existing book."
            break
          }
        }

        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 409) &&
          op.type === "delete"
        ) {
          await deleteBookRecord(op.isbn)
          await removeOutboxOp(op.id)
          continue
        }

        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ) {
          lastError = error.message
          await removeOutboxOp(op.id)
          continue
        }

        lastError = error instanceof Error ? error.message : "Sync failed."
        break
      }
    }

    if (isBrowserOnline()) {
      await setLastSyncedAt(Date.now())
    }
  } finally {
    draining = false
    syncing = false
    notifyLibrary()
  }
}

export async function hydrateLibrary(): Promise<void> {
  notifyLibrary()
  await pullRemoteCatalog()
  await drainOutbox()
}

export function startOfflineSync() {
  if (started || typeof window === "undefined") return
  started = true

  const onOnline = () => {
    void pullRemoteCatalog().then(() => drainOutbox())
  }

  window.addEventListener("online", onOnline)
  window.addEventListener("offline", () => notifyLibrary())
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onOnline()
  })
  window.setInterval(() => {
    if (isBrowserOnline()) void drainOutbox()
  }, 30_000)

  void hydrateLibrary()
}
