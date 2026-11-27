import {
  addBook,
  ApiError,
  getBook,
  listBooks,
  removeBook,
  updateBook,
} from "@/lib/api/books"
import {
  getBookByIsbn,
  getLastSyncedAt,
  getOutbox,
  getOutboxOp,
  resetOutboxOpsForRetry,
  setLastSyncedAt,
  updateOutboxOp,
} from "./db"
import { notifyLibrary } from "./events"
import {
  commitSyncedBookOp,
  commitSyncedDeleteOp,
  dropAndReconcileOp,
  replaceRemoteCatalog,
} from "./books-repository"
import { warmCoverCache } from "./covers"
import type { BookCreatePayload, OutboxOp, SyncStatus } from "./types"

export const BACKGROUND_SYNC_TAG = "maktaba-sync"
export const PERIODIC_SYNC_TAG = "maktaba-periodic"

const MAX_CONCURRENT_ISBNS = 2
const DEFAULT_BASE_RETRY_DELAY_MS = 2_000
const MAX_RETRY_DELAY_MS = 60_000

export type DrainResult = {
  attempted: number
  succeeded: number
  retryableRemaining: number
  pausedRemaining: number
}

type DrainOutcome = "done" | "dropped" | "skipped" | "retry" | "rate-limited" | "paused"

type DrainOptions = {
  force: boolean
  respectBackoff: boolean
}

let pulling = false
let started = false
let outboxError: string | undefined
let catalogError: string | undefined
let syncing = false
let work = 0
let rateLimitedUntil = 0
let baseRetryDelayMs = DEFAULT_BASE_RETRY_DELAY_MS
let retryTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null

let activeDrainPromise: Promise<DrainResult> | null = null
let queuedDrainOptions: DrainOptions | null = null
let activeWake: (() => void) | null = null

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
  const now = Date.now()
  const preserve = new Set(inFlightIsbns)
  for (const [isbn, at] of writtenAt) {
    if (at >= startedAt || now - at < 5_000) preserve.add(isbn)
    else if (startedAt - at > 60_000) writtenAt.delete(isbn)
  }
  return preserve
}

export function buildSyncSnapshot(
  ops: OutboxOp[],
  lastSyncedAt?: number
): SyncStatus {
  const pausedCount = ops.filter((op) => op.paused).length
  const firstOpError = ops.find((op) => op.lastError)?.lastError
  return {
    online: isBrowserOnline(),
    syncing,
    pendingCount: ops.length,
    pausedCount,
    lastSyncedAt,
    lastError: firstOpError ?? outboxError ?? catalogError,
  }
}

export function getSyncSnapshot(
  pendingCount: number,
  lastSyncedAt?: number
): SyncStatus {
  return {
    online: isBrowserOnline(),
    syncing,
    pendingCount,
    lastSyncedAt,
    lastError: outboxError ?? catalogError,
  }
}

export async function readSyncStatus(): Promise<SyncStatus> {
  const [ops, lastSyncedAt] = await Promise.all([
    getOutbox(),
    getLastSyncedAt(),
  ])
  return buildSyncSnapshot(ops, lastSyncedAt)
}

export function clearSyncError() {
  outboxError = undefined
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
    catalogError = undefined
    warmCoverCache(remote)
  } catch (error) {
    catalogError = error instanceof Error ? error.message : "Could not sync library."
  } finally {
    pulling = false
    endWork()
  }
}

function hasUpdatableFields(payload?: BookCreatePayload): boolean {
  if (!payload) return false
  return Object.values(payload).some(
    (value) => value !== undefined && String(value).trim() !== ""
  )
}

async function recordIdFor(isbn: string): Promise<string | undefined> {
  const local = await getBookByIsbn(isbn)
  return local?.id
}

async function recordRetryFailure(
  op: OutboxOp,
  message: string,
  status?: number
): Promise<DrainOutcome> {
  const now = Date.now()
  const attempts = (op.attempts ?? 0) + 1
  const exponent = Math.min(attempts - 1, 5)
  const jitter = Math.round(Math.random() * 250)
  const delay = Math.min(
    MAX_RETRY_DELAY_MS,
    baseRetryDelayMs * 2 ** exponent + jitter
  )
  outboxError = message
  await updateOutboxOp(op.id, (current) => ({
    ...current,
    attempts: (current.attempts ?? 0) + 1,
    lastAttemptAt: now,
    lastError: message,
    lastStatus: status,
    nextRetryAt: now + delay,
  }))
  notifyLibrary()
  return "retry"
}

async function recordRateLimitFailure(
  op: OutboxOp,
  error: ApiError
): Promise<DrainOutcome> {
  const now = Date.now()
  const waitMs = Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(error.retryAfterMs ?? 10_000, 2_000)
  )
  rateLimitedUntil = Math.max(rateLimitedUntil, now + waitMs)
  outboxError = error.message
  await updateOutboxOp(op.id, (current) => ({
    ...current,
    attempts: (current.attempts ?? 0) + 1,
    lastAttemptAt: now,
    lastError: error.message,
    lastStatus: 429,
    nextRetryAt: rateLimitedUntil,
  }))
  notifyLibrary()
  return "rate-limited"
}

async function recordPausedFailure(
  op: OutboxOp,
  message: string,
  status: number
): Promise<DrainOutcome> {
  const now = Date.now()
  outboxError = message
  await updateOutboxOp(op.id, (current) => ({
    ...current,
    attempts: (current.attempts ?? 0) + 1,
    lastAttemptAt: now,
    lastError: message,
    lastStatus: status,
    nextRetryAt: undefined,
    paused: true,
  }))
  notifyLibrary()
  return "paused"
}

async function applyOutboxOp(op: OutboxOp): Promise<DrainOutcome> {
  inFlightIsbns.add(op.isbn)
  try {
    const marked = await updateOutboxOp(op.id, (current) => ({
      ...current,
      lastAttemptAt: Date.now(),
    }))
    if (!marked) return "skipped"
    const outcome = await sendOutboxOp(marked)
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
      const outcome = await commitSyncedBookOp(op.id, op.isbn, created)
      if (outcome === "done") outboxError = undefined
      return outcome
    }
    if (op.type === "update") {
      const updated = await updateBook(op.isbn, op.payload ?? {}, recordId)
      const outcome = await commitSyncedBookOp(op.id, op.isbn, updated)
      if (outcome === "done") outboxError = undefined
      return outcome
    }
    await removeBook(op.isbn, recordId)
    const outcome = await commitSyncedDeleteOp(op.id, op.isbn)
    if (outcome === "done") outboxError = undefined
    return outcome
  } catch (error) {
    const stillPending = await getOutboxOp(op.id)
    if (!stillPending) return "skipped"

    if (
      error instanceof ApiError &&
      error.isJsonResponse &&
      error.status === 409 &&
      op.type === "create"
    ) {
      try {
        const existing = await getBook(op.isbn)
        if (hasUpdatableFields(op.payload)) {
          try {
            const updated = await updateBook(
              op.isbn,
              op.payload!,
              existing.id
            )
            const outcome = await commitSyncedBookOp(op.id, op.isbn, updated)
            if (outcome === "done") outboxError = undefined
            return outcome
          } catch (patchError) {
            if (
              patchError instanceof ApiError &&
              patchError.status === 400
            ) {
              const outcome = await commitSyncedBookOp(op.id, op.isbn, existing)
              if (outcome === "done") outboxError = undefined
              return outcome
            }
            throw patchError
          }
        }
        const outcome = await commitSyncedBookOp(op.id, op.isbn, existing)
        if (outcome === "done") outboxError = undefined
        return outcome
      } catch (inner) {
        if (
          inner instanceof ApiError &&
          inner.isJsonResponse &&
          inner.status === 404
        ) {
          return recordRetryFailure(stillPending, inner.message, 404)
        }
        if (inner instanceof ApiError && inner.status === 429) {
          return recordRateLimitFailure(stillPending, inner)
        }
        if (
          inner instanceof ApiError &&
          inner.isJsonResponse &&
          inner.status === 422
        ) {
          return recordPausedFailure(stillPending, inner.message, 422)
        }
        if (inner instanceof ApiError && inner.status === 400) {
          outboxError = inner.message
          await dropAndReconcileOp(op.id, op.isbn)
          return "dropped"
        }
        return recordRetryFailure(
          stillPending,
          inner instanceof Error
            ? inner.message
            : "Could not merge existing book.",
          inner instanceof ApiError ? inner.status : undefined
        )
      }
    }

    if (
      error instanceof ApiError &&
      error.isJsonResponse &&
      (error.status === 404 || error.status === 409) &&
      op.type === "delete"
    ) {
      const outcome = await commitSyncedDeleteOp(op.id, op.isbn)
      if (outcome === "done") outboxError = undefined
      return outcome
    }

    if (
      error instanceof ApiError &&
      error.isJsonResponse &&
      error.status === 404 &&
      op.type === "create" &&
      !op.payload?.Title?.trim()
    ) {
      return recordPausedFailure(
        stillPending,
        "Book not found in catalog. Open it to add a title, or drop it.",
        404
      )
    }

    if (
      error instanceof ApiError &&
      error.isJsonResponse &&
      error.status === 422
    ) {
      return recordPausedFailure(stillPending, error.message, 422)
    }

    if (
      error instanceof ApiError &&
      (error.status === 400 ||
        (error.isJsonResponse && error.status === 404 && op.type === "update"))
    ) {
      outboxError = error.message
      await dropAndReconcileOp(op.id, op.isbn)
      return "dropped"
    }

    if (error instanceof ApiError && error.status === 429) {
      return recordRateLimitFailure(stillPending, error)
    }

    return recordRetryFailure(
      stillPending,
      error instanceof Error ? error.message : "Sync failed.",
      error instanceof ApiError ? error.status : undefined
    )
  }
}

function summarizeRemaining(
  ops: OutboxOp[],
  attempted: number,
  succeeded: number
): DrainResult {
  const pausedRemaining = ops.filter((op) => op.paused).length
  return {
    attempted,
    succeeded,
    retryableRemaining: ops.length - pausedRemaining,
    pausedRemaining,
  }
}

function clearRetryTimer() {
  if (retryTimer !== null) {
    globalThis.clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleNextRetry(ops: OutboxOp[]) {
  clearRetryTimer()
  if (!started || typeof window === "undefined") return
  const retryable = ops.filter((op) => !op.paused)
  if (retryable.length === 0) return

  let earliest = Infinity
  for (const op of retryable) {
    if (typeof op.nextRetryAt === "number") {
      earliest = Math.min(earliest, op.nextRetryAt)
    }
  }
  if (rateLimitedUntil > Date.now()) {
    earliest =
      earliest === Infinity
        ? rateLimitedUntil
        : Math.max(earliest, rateLimitedUntil)
  }
  if (!Number.isFinite(earliest)) return

  const delayMs = Math.max(250, earliest - Date.now())
  retryTimer = globalThis.setTimeout(() => {
    retryTimer = null
    if (isBrowserOnline()) {
      void drainOutbox({ respectBackoff: true })
    }
  }, delayMs)
}

async function runDrainPass(options: DrainOptions): Promise<DrainResult> {
  if (!isBrowserOnline() && !options.force) {
    const ops = await getOutbox()
    return summarizeRemaining(ops, 0, 0)
  }

  let attempted = 0
  let succeeded = 0
  const activeIsbns = new Set<string>()
  const blockedOpIds = new Set<string>()
  const activePromises = new Set<Promise<void>>()
  let wakeResolver: (() => void) | null = null
  let stopNewWork = false

  const wake = () => {
    if (wakeResolver) {
      const resolve = wakeResolver
      wakeResolver = null
      resolve()
    }
  }

  activeWake = wake
  beginWork()
  try {
    while (true) {
      if (!isBrowserOnline() && !options.force) break
      if (!options.force && rateLimitedUntil > Date.now()) break

      const ops = await getOutbox()
      const headByIsbn = new Map<string, OutboxOp>()
      for (const op of ops) {
        if (!headByIsbn.has(op.isbn)) headByIsbn.set(op.isbn, op)
      }

      if (!stopNewWork) {
        const now = Date.now()
        for (const [isbn, headOp] of headByIsbn) {
          if (activeIsbns.size >= MAX_CONCURRENT_ISBNS) break
          if (activeIsbns.has(isbn)) continue
          if (blockedOpIds.has(headOp.id)) continue
          if (headOp.paused) {
            blockedOpIds.add(headOp.id)
            continue
          }
          if (
            options.respectBackoff &&
            !options.force &&
            headOp.nextRetryAt &&
            headOp.nextRetryAt > now
          ) {
            blockedOpIds.add(headOp.id)
            continue
          }

          activeIsbns.add(isbn)
          const worker = (async () => {
            let currentOp: OutboxOp | undefined = headOp
            while (currentOp) {
              if (!isBrowserOnline() && !options.force) break
              if (!options.force && rateLimitedUntil > Date.now()) break

              const live = await getOutboxOp(currentOp.id)
              if (!live) {
                const latestOps = await getOutbox()
                const nextHead = latestOps.find((item) => item.isbn === isbn)
                if (
                  !nextHead ||
                  blockedOpIds.has(nextHead.id) ||
                  nextHead.paused
                ) {
                  break
                }
                currentOp = nextHead
                continue
              }

              attempted += 1
              const outcome = await applyOutboxOp(live)
              if (outcome === "done" || outcome === "dropped") {
                if (outcome === "done") succeeded += 1
                const latestOps = await getOutbox()
                const nextHead = latestOps.find((item) => item.isbn === isbn)
                if (
                  !nextHead ||
                  blockedOpIds.has(nextHead.id) ||
                  nextHead.paused
                ) {
                  currentOp = undefined
                } else {
                  currentOp = nextHead
                }
              } else if (outcome === "skipped") {
                const latestOps = await getOutbox()
                const nextHead = latestOps.find((item) => item.isbn === isbn)
                if (
                  !nextHead ||
                  blockedOpIds.has(nextHead.id) ||
                  nextHead.paused
                ) {
                  currentOp = undefined
                } else {
                  currentOp = nextHead
                }
              } else {
                blockedOpIds.add(live.id)
                if (outcome === "rate-limited") {
                  stopNewWork = true
                }
                currentOp = undefined
              }
            }
          })()
            .catch((error) => {
              outboxError =
                error instanceof Error ? error.message : "Sync failed."
              blockedOpIds.add(headOp.id)
            })
            .finally(() => {
              activeIsbns.delete(isbn)
              activePromises.delete(worker)
              wake()
            })

          activePromises.add(worker)
        }
      }

      if (activePromises.size === 0) break

      await new Promise<void>((resolve) => {
        wakeResolver = resolve
      })
    }

    if (activePromises.size > 0) {
      await Promise.all([...activePromises])
    }

    const finalOps = await getOutbox()
    const result = summarizeRemaining(finalOps, attempted, succeeded)
    if (
      succeeded > 0 &&
      result.retryableRemaining === 0 &&
      isBrowserOnline()
    ) {
      await setLastSyncedAt(Date.now())
    }
    scheduleNextRetry(finalOps)
    if (result.retryableRemaining > 0) {
      void requestBackgroundSync()
    }
    return result
  } finally {
    if (activeWake === wake) activeWake = null
    endWork()
    notifyLibrary()
  }
}

export async function drainOutbox(options?: {
  force?: boolean
  respectBackoff?: boolean
}): Promise<DrainResult> {
  const opts: DrainOptions = {
    force: Boolean(options?.force),
    respectBackoff: Boolean(options?.respectBackoff),
  }

  if (activeDrainPromise) {
    queuedDrainOptions = {
      force: Boolean(queuedDrainOptions?.force || opts.force),
      respectBackoff: Boolean(
        (queuedDrainOptions ? queuedDrainOptions.respectBackoff : true) &&
          opts.respectBackoff
      ),
    }
    if (activeWake && !opts.force) {
      activeWake()
    }
    return activeDrainPromise
  }

  const run = (async (): Promise<DrainResult> => {
    let latestResult: DrainResult = {
      attempted: 0,
      succeeded: 0,
      retryableRemaining: 0,
      pausedRemaining: 0,
    }
    let currentOpts = opts
    while (true) {
      queuedDrainOptions = null
      await withOriginLock("maktaba-drain", async () => {
        latestResult = await runDrainPass(currentOpts)
      })
      if (!queuedDrainOptions) break
      const ops = await getOutbox()
      const latestQueued = queuedDrainOptions as DrainOptions | null
      if (!latestQueued) break
      const hasEligible = ops.some((op) => !op.paused)
      if (!hasEligible && !latestQueued.force) break
      currentOpts = latestQueued
    }
    return latestResult
  })()

  activeDrainPromise = run
  try {
    return await run
  } finally {
    if (activeDrainPromise === run) {
      activeDrainPromise = null
      queuedDrainOptions = null
    }
  }
}

export async function retryOutboxNow(opId?: string): Promise<DrainResult> {
  rateLimitedUntil = 0
  outboxError = undefined
  await resetOutboxOpsForRetry(opId)
  notifyLibrary()
  return drainOutbox({ force: true })
}

export async function drainOutboxForBackgroundSync(): Promise<void> {
  const result = await drainOutbox({ force: false, respectBackoff: false })
  if (result.retryableRemaining > 0) {
    throw new Error(
      `Deferred sync: ${result.retryableRemaining} pending change(s) remaining.`
    )
  }
  await pullRemoteCatalog()
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
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onOnline()
    })
  }
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) onOnline()
  })
  intervalTimer = globalThis.setInterval(() => {
    if (!isBrowserOnline()) return
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      void drainOutbox({ respectBackoff: true })
      return
    }
    void hydrateLibrary()
  }, 30_000)

  void requestBackgroundSync()
  void requestPeriodicBackgroundSync()
  void hydrateLibrary()
}

export function __resetSyncForTests(options?: { baseRetryDelayMs?: number }) {
  clearRetryTimer()
  if (intervalTimer !== null) {
    globalThis.clearInterval(intervalTimer)
    intervalTimer = null
  }
  pulling = false
  started = false
  outboxError = undefined
  catalogError = undefined
  syncing = false
  work = 0
  rateLimitedUntil = 0
  baseRetryDelayMs = options?.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS
  activeDrainPromise = null
  queuedDrainOptions = null
  activeWake = null
  inFlightIsbns.clear()
  writtenAt.clear()
}
