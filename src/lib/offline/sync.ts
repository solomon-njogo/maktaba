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
  getBookByIsbn,
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
import type { OutboxOp, SyncStatus } from "./types"

export const BACKGROUND_SYNC_TAG = "maktaba-sync"
export const PERIODIC_SYNC_TAG = "maktaba-periodic"

let pulling = false
let started = false
let lastError: string | undefined
let syncing = false
let work = 0
let localDrains = 0
const scheduled = new Set<string>()
const tails = new Map<string, Promise<void>>()
const inFlightIsbns = new Set<string>()
const writtenAt = new Map<string, number>()

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> }
  periodicSync?: {
    register: (tag: string, options?: { minInterval: number }) => Promise<void>
  }
}

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine
}

function beginWork() {
  work += 1
  if (syncing) return
  syncing = true
  notifyLibrary()
}

function endWork() {
  work = Math.max(0, work - 1)
  if (work > 0 || !syncing) return
  syncing = false
  notifyLibrary()
}

async function withOriginLock(
  name: string,
  task: () => Promise<void>
): Promise<void> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks
  if (!locks) {
    await task()
    return
  }
  await locks.request(name, () => task())
}

function preserveIsbns(startedAt: number): Set<string> {
  const preserve = new Set(inFlightIsbns)
  for (const [isbn, at] of writtenAt) {
    if (at >= startedAt) preserve.add(isbn)
    else if (startedAt - at > 60_000) writtenAt.delete(isbn)
  }
  return preserve
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
  beginWork()
  const startedAt = Date.now()
  try {
    const remote = await listBooks()
    await replaceRemoteCatalog(remote, preserveIsbns(startedAt))
    await setLastSyncedAt(Date.now())
    lastError = undefined
    warmCoverCache(remote)
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Could not sync library."
  } finally {
    pulling = false
    endWork()
  }
}

type DrainOutcome = "done" | "retry"

function isTerminalClientError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  )
}

async function recordIdFor(isbn: string): Promise<string | undefined> {
  const local = await getBookByIsbn(isbn)
  return local?.id
}

async function applyOutboxOp(op: OutboxOp): Promise<DrainOutcome> {
  inFlightIsbns.add(op.isbn)
  try {
    const outcome = await sendOutboxOp(op)
    if (outcome === "done") writtenAt.set(op.isbn, Date.now())
    return outcome
  } finally {
    inFlightIsbns.delete(op.isbn)
  }
}

async function sendOutboxOp(op: OutboxOp): Promise<DrainOutcome> {
  try {
    const recordId = op.type === "create" ? undefined : await recordIdFor(op.isbn)
    if (op.type === "create") {
      const created = await addBook(op.isbn, op.payload)
      await upsertRemoteBook(created, {
        preserveLocal: await isbnHasOtherOps(op.isbn, op.id),
      })
    } else if (op.type === "update") {
      const updated = await updateBook(op.isbn, op.payload ?? {}, recordId)
      await upsertRemoteBook(updated, {
        preserveLocal: await isbnHasOtherOps(op.isbn, op.id),
      })
    } else {
      await removeBook(op.isbn, recordId)
      await deleteBookRecord(op.isbn)
    }
    await removeOutboxOp(op.id)
    lastError = undefined
    return "done"
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
        return "done"
      } catch (inner) {
        if (isTerminalClientError(inner)) {
          lastError = inner.message
          await removeOutboxOp(op.id)
          return "done"
        }
        lastError =
          inner instanceof Error ? inner.message : "Could not merge existing book."
        return "retry"
      }
    }

    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 409) &&
      op.type === "delete"
    ) {
      await deleteBookRecord(op.isbn)
      await removeOutboxOp(op.id)
      return "done"
    }

    if (isTerminalClientError(error)) {
      lastError = error.message
      await removeOutboxOp(op.id)
      return "done"
    }

    lastError = error instanceof Error ? error.message : "Sync failed."
    return "retry"
  }
}

const isbnAttempt = new Map<string, number>()

function schedule(op: OutboxOp): Promise<void> | null {
  if (scheduled.has(op.id)) return null
  scheduled.add(op.id)
  const attempt = isbnAttempt.get(op.isbn) ?? 0
  const prev = tails.get(op.isbn) ?? Promise.resolve()
  const run = prev.then(async () => {
    try {
      if ((isbnAttempt.get(op.isbn) ?? 0) !== attempt) return
      const still = (await getOutbox()).some((item) => item.id === op.id)
      if (!still) return
      const outcome = await applyOutboxOp(op)
      if (outcome === "retry") isbnAttempt.set(op.isbn, attempt + 1)
    } finally {
      scheduled.delete(op.id)
    }
  })
  tails.set(
    op.isbn,
    run.then(
      () => undefined,
      () => undefined
    )
  )
  return run
}

async function sendPending(): Promise<void> {
  if (!isBrowserOnline()) return
  beginWork()
  try {
    const ops = await getOutbox()
    const waits: Promise<void>[] = []
    for (const op of ops) {
      const pending = schedule(op)
      if (pending) waits.push(pending)
    }
    await Promise.all(waits)
    if (isBrowserOnline()) await setLastSyncedAt(Date.now())
  } finally {
    endWork()
  }
}

async function drainOutboxOnce(): Promise<void> {
  const leader = localDrains === 0
  localDrains += 1
  try {
    if (leader) await withOriginLock("maktaba-drain", sendPending)
    else await sendPending()
  } finally {
    localDrains -= 1
  }
}

export function drainOutbox(): Promise<void> {
  return drainOutboxOnce()
}

export async function hydrateLibrary(): Promise<void> {
  notifyLibrary()
  await Promise.all([drainOutbox(), pullRemoteCatalog()])
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
