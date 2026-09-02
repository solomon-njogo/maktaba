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
import { warmCoverCache } from "./covers"
import type { SyncStatus } from "./types"

export const BACKGROUND_SYNC_TAG = "maktaba-sync"
export const PERIODIC_SYNC_TAG = "maktaba-periodic"

let draining = false
let pulling = false
let started = false
let lastError: string | undefined
let syncing = false

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> }
  periodicSync?: {
    register: (tag: string, options?: { minInterval: number }) => Promise<void>
  }
}

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

export async function requestBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const registration = (await navigator.serviceWorker.ready) as SyncCapableRegistration
    await registration.sync?.register(BACKGROUND_SYNC_TAG)
  } catch {
    // Background Sync is unavailable (Safari) or the browser refused the tag.
  }
}

export async function requestPeriodicBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  try {
    const registration = (await navigator.serviceWorker.ready) as SyncCapableRegistration
    if (!registration.periodicSync) return
    const status = await navigator.permissions.query({
      name: "periodic-background-sync" as PermissionName,
    })
    if (status.state !== "granted") return
    await registration.periodicSync.register(PERIODIC_SYNC_TAG, {
      minInterval: 15 * 60 * 1000,
    })
  } catch {
    // Periodic Background Sync is Chrome/Edge installed-PWA only.
  }
}

export async function pullRemoteCatalog(): Promise<void> {
  if (!isBrowserOnline() || pulling) return
  pulling = true
  syncing = true
  notifyLibrary()
  try {
    const remote = await listBooks()
    await replaceRemoteCatalog(remote)
    await setLastSyncedAt(Date.now())
    lastError = undefined
    warmCoverCache(remote)
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Could not sync library."
  } finally {
    pulling = false
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
    void hydrateLibrary()
    void requestBackgroundSync()
  }

  window.addEventListener("online", onOnline)
  window.addEventListener("offline", () => {
    notifyLibrary()
    void requestBackgroundSync()
  })
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onOnline()
  })
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) onOnline()
  })
  window.setInterval(() => {
    if (isBrowserOnline()) void hydrateLibrary()
  }, 30_000)

  void requestBackgroundSync()
  void requestPeriodicBackgroundSync()
  void hydrateLibrary()
}
