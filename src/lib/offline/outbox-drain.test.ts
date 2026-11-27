import "fake-indexeddb/auto"

import assert from "node:assert/strict"
import { after, afterEach, beforeEach, describe, it } from "node:test"

import type { FormattedBookResponse } from "@/types/books"

import {
  CATALOG_BUDGET_MS,
  SYNC_LOOKUP_CREATE_BUDGET_MS,
  SYNC_WRITE_BUDGET_MS,
} from "../api/books.ts"
import {
  createLocalBook,
  removeLocalBook,
  replaceRemoteCatalog,
  updateLocalBook,
  upsertRemoteBook,
} from "./books-repository.ts"
import {
  addOutboxOp,
  clearOutbox,
  deleteBookRecord,
  getBookByIsbn,
  getDb,
  getOutbox,
  putBook,
  removeOutboxOp,
  replaceOutboxOrder,
  resetDbConnection,
} from "./db.ts"
import {
  __resetSyncForTests,
  drainOutbox,
  drainOutboxForBackgroundSync,
  hydrateLibrary,
  pullRemoteCatalog,
  readSyncStatus,
  retryOutboxNow,
} from "./sync.ts"

Object.defineProperty(navigator, "onLine", {
  configurable: true,
  value: true,
})

type Call = { url: string; method: string; headers?: HeadersInit; body?: string }

const calls: Call[] = []
let restoreFetch: (() => void) | undefined
let restoreLocks: (() => void) | undefined

const TEST_ISBNS = [
  "9780000000001",
  "9780000000002",
  "9780000000003",
  "9780000000004",
  "9780000000005",
  "9780000000006",
  "014312774X",
]

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

function bookBody(
  isbn: string,
  title = "Queue Probe",
  id = "rec_probe"
): FormattedBookResponse {
  return {
    id,
    Title: title,
    Author: "Probe",
    ISBN: isbn,
    Status: "TBR",
    Borrowed: "No",
    inLibrary: true,
  }
}

function createLockSimulator() {
  const queues = new Map<string, Promise<void>>()
  const activeCounts = new Map<string, number>()
  const maxActiveCounts = new Map<string, number>()

  const locks = {
    async request(name: string, cb: () => Promise<unknown>) {
      const prev = queues.get(name) ?? Promise.resolve()
      let release!: () => void
      const next = new Promise<void>((resolve) => {
        release = resolve
      })
      queues.set(name, next)
      await prev
      const count = (activeCounts.get(name) ?? 0) + 1
      activeCounts.set(name, count)
      maxActiveCounts.set(name, Math.max(maxActiveCounts.get(name) ?? 0, count))
      try {
        return await cb()
      } finally {
        activeCounts.set(name, (activeCounts.get(name) ?? 1) - 1)
        release()
      }
    },
  }

  return { locks, activeCounts, maxActiveCounts }
}

beforeEach(() => {
  calls.length = 0
  __resetSyncForTests({ baseRetryDelayMs: 50 })
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  })
  const previous = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    calls.push({
      url,
      method,
      headers: init?.headers,
      body: typeof init?.body === "string" ? init.body : undefined,
    })
    if (method === "GET" && url.startsWith("/api/books")) return jsonResponse([])
    if (method === "POST" && url === "/api/books") {
      const payload = JSON.parse(String(init?.body)) as {
        isbn?: string
        Title?: string
      }
      return jsonResponse(bookBody(payload.isbn ?? "", payload.Title), 201)
    }
    return jsonResponse({ error: `unexpected ${method} ${url}` }, 500)
  }
  restoreFetch = () => {
    globalThis.fetch = previous
  }
})

afterEach(async () => {
  restoreFetch?.()
  restoreLocks?.()
  restoreLocks = undefined
  __resetSyncForTests()
  await clearOutbox()
  for (const isbn of TEST_ISBNS) {
    await deleteBookRecord(isbn)
  }
})

after(async () => {
  const db = await getDb()
  db.close()
  resetDbConnection()
})

async function settledOutbox() {
  const deadline = Date.now() + 2000
  let ops = await getOutbox()
  while (ops.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    ops = await getOutbox()
  }
  return ops
}

describe("outbox drain", () => {
  it("clears a create once the library accepts it", async () => {
    await createLocalBook("9780000000001", {
      Title: "Queue Probe",
      Author: "Probe",
    })
    await drainOutbox()
    const ops = await settledOutbox()
    const status = await readSyncStatus()
    assert.deepEqual(
      ops.map((op) => op.isbn),
      []
    )
    assert.equal(status.lastError ?? null, null)
    assert.equal(
      calls.some((call) => call.method === "POST" && call.url === "/api/books"),
      true
    )
  })

  it("syncs a change that arrives while an earlier sync is still running", async () => {
    let releaseFirst: (() => void) | undefined
    let posts = 0
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "GET") return jsonResponse([])
      if (method === "POST") {
        posts += 1
        const payload = JSON.parse(String(init?.body)) as {
          isbn?: string
          Title?: string
        }
        if (posts === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
        }
        return jsonResponse(bookBody(payload.isbn ?? "", payload.Title), 201)
      }
      return jsonResponse({ error: "no" }, 500)
    }

    const firstQueued = createLocalBook("9780000000001", {
      Title: "First",
      Author: "Probe",
    })
    const started = Date.now()
    while (posts < 1 && Date.now() - started < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.equal(posts, 1, "the first sync never started")
    await firstQueued

    await createLocalBook("9780000000002", {
      Title: "Second",
      Author: "Probe",
    })
    releaseFirst?.()

    const ops = await settledOutbox()
    assert.deepEqual(
      ops.map((op) => `${op.type}:${op.isbn}`),
      [],
      "a change that arrived during sync stayed in the queue"
    )
    assert.equal(posts, 2)
  })

  it("drops a create when the library rejects it with a non-JSON error page", async () => {
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "POST") {
        return new Response("<html>bad request</html>", {
          status: 400,
          headers: { "Content-Type": "text/html" },
        })
      }
      return jsonResponse([])
    }

    await createLocalBook("9780000000001", {
      Title: "Queue Probe",
      Author: "Probe",
    })
    await drainOutbox()
    const ops = await settledOutbox()
    const status = await readSyncStatus()
    assert.deepEqual(
      ops.map((op) => op.isbn),
      []
    )
    assert.match(status.lastError ?? "", /bad request|Request failed|400/i)
  })

  it("keeps syncing other books when one write fails", async () => {
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "GET") return jsonResponse([])
      if (method === "POST") {
        const payload = JSON.parse(String(init?.body)) as {
          isbn?: string
          Title?: string
        }
        if (payload.isbn === "9780000000001") {
          return jsonResponse({ error: "Airtable is down." }, 500)
        }
        return jsonResponse(bookBody(payload.isbn ?? "", payload.Title), 201)
      }
      return jsonResponse({ error: "no" }, 500)
    }

    await createLocalBook("9780000000001", { Title: "Bad", Author: "Probe" })
    await createLocalBook("9780000000002", { Title: "Good", Author: "Probe" })
    await drainOutbox()

    const deadline = Date.now() + 1000
    let ops = await getOutbox()
    while (ops.some((op) => op.isbn === "9780000000002") && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      ops = await getOutbox()
    }
    assert.deepEqual(
      ops.map((op) => op.isbn),
      ["9780000000001"]
    )
  })

  it("clears each queued book within one second", async () => {
    let posts = 0
    let releaseFirst: (() => void) | undefined
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "GET") return jsonResponse([])
      if (method === "POST") {
        posts += 1
        const payload = JSON.parse(String(init?.body)) as {
          isbn?: string
          Title?: string
        }
        if (posts === 1) await firstHeld
        await new Promise((resolve) => setTimeout(resolve, 700))
        return jsonResponse(bookBody(payload.isbn ?? "", payload.Title), 201)
      }
      return jsonResponse({ error: "no" }, 500)
    }

    const firstQueued = createLocalBook("9780000000001", {
      Title: "First",
      Author: "Probe",
    })
    const started = Date.now()
    while (posts < 1 && Date.now() - started < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.equal(posts, 1)
    await firstQueued
    await createLocalBook("9780000000002", {
      Title: "Second",
      Author: "Probe",
    })

    const mark = Date.now()
    releaseFirst?.()
    const deadline = mark + 1000
    let ops = await getOutbox()
    while (ops.length > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      ops = await getOutbox()
    }
    assert.deepEqual(
      ops.map((op) => op.isbn),
      [],
      "a queued book was still pending after one second"
    )
  })

  it("sends the queue without waiting for a catalog sync", async () => {
    await addOutboxOp({
      id: "op-ahead-of-catalog",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "Queue Probe", Author: "Probe" },
      createdAt: Date.now(),
      queuedAt: Date.now(),
    })
    let releaseCatalog: (() => void) | undefined
    const catalogHeld = new Promise<void>((resolve) => {
      releaseCatalog = resolve
    })
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "GET" && url.startsWith("/api/books")) {
        await catalogHeld
        return jsonResponse([])
      }
      if (method === "POST") {
        const payload = JSON.parse(String(init?.body)) as {
          isbn?: string
          Title?: string
        }
        return jsonResponse(bookBody(payload.isbn ?? "", payload.Title), 201)
      }
      return jsonResponse([])
    }

    const syncing = hydrateLibrary()
    try {
      const deadline = Date.now() + 1000
      let ops = await getOutbox()
      while (ops.length > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 20))
        ops = await getOutbox()
      }
      assert.deepEqual(
        ops.map((op) => op.isbn),
        []
      )
    } finally {
      releaseCatalog?.()
      await Promise.race([
        syncing,
        new Promise((resolve) => setTimeout(resolve, 50)),
      ])
    }
  })

  it("coalesces offline create+update, update+update (clearing Borrowed), and unattempted create+delete", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })

    await createLocalBook("9780000000001")
    await updateLocalBook("9780000000001", {
      Title: "Dune",
      Status: "Reading",
    })

    await createLocalBook("9780000000002", { Title: "Temp" })
    await removeLocalBook("9780000000002")

    await putBook({
      ...bookBody("9780000000003", "Existing", "rec_3"),
      pending: false,
    })
    await updateLocalBook("9780000000003", {
      Borrowed: "Yes",
      BorrowedBy: "Sam",
    })
    await updateLocalBook("9780000000003", {
      Borrowed: "No",
      Status: "Done",
    })

    const ops = await getOutbox()
    assert.equal(ops.length, 2)
    const op1 = ops.find((op) => op.isbn === "9780000000001")
    const op3 = ops.find((op) => op.isbn === "9780000000003")
    assert.equal(op1?.type, "create")
    assert.equal(op1?.payload?.Title, "Dune")
    assert.equal(op1?.payload?.Status, "Reading")
    assert.equal(await getBookByIsbn("9780000000002"), undefined)
    assert.equal(op3?.type, "update")
    assert.equal(op3?.payload?.Borrowed, "No")
    assert.equal(op3?.payload?.Status, "Done")
    assert.equal(op3?.payload?.BorrowedBy, undefined)
    assert.equal(calls.length, 0)
  })

  it("preserves concurrent updates made while an earlier create is in-flight via fresh op ID", async () => {
    let releaseFirst: (() => void) | undefined
    let postCount = 0
    let serverBook = bookBody("9780000000001", "Looking up…", "rec_1")
    let conflictTriggered = false

    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "POST" && url === "/api/books") {
        postCount += 1
        if (postCount === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve
          })
          return jsonResponse(serverBook, 201)
        }
        conflictTriggered = true
        return jsonResponse({ error: "already exists" }, 409)
      }
      if (method === "GET" && url === "/api/books/9780000000001") {
        return jsonResponse(serverBook)
      }
      if (method === "PATCH" && url === "/api/books/9780000000001") {
        const patch = JSON.parse(String(init?.body)) as {
          Title?: string
          Status?: "Reading"
        }
        const headerId = (init?.headers as Record<string, string>)?.[
          "x-record-id"
        ]
        assert.equal(headerId, "rec_1")
        serverBook = {
          ...serverBook,
          Title: patch.Title ?? serverBook.Title,
          Status: patch.Status ?? serverBook.Status,
        }
        return jsonResponse(serverBook)
      }
      return jsonResponse([])
    }

    const creating = createLocalBook("9780000000001")
    const deadline = Date.now() + 1000
    while (postCount < 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await creating

    await updateLocalBook("9780000000001", {
      Title: "Updated In Flight",
      Status: "Reading",
    })
    releaseFirst?.()

    const ops = await settledOutbox()
    assert.equal(ops.length, 0)
    assert.equal(conflictTriggered, true)
    const saved = await getBookByIsbn("9780000000001")
    assert.equal(saved?.Title, "Updated In Flight")
    assert.equal(saved?.Status, "Reading")
    assert.equal(saved?.id, "rec_1")
  })

  it("enforces strict navigator.locks mutual exclusion even on overlapping drainOutbox calls", async () => {
    const previousDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "locks"
    )
    const { locks, maxActiveCounts } = createLockSimulator()
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: locks,
    })
    restoreLocks = () => {
      if (previousDescriptor) {
        Object.defineProperty(navigator, "locks", previousDescriptor)
      } else {
        delete (navigator as unknown as Record<string, unknown>).locks
      }
    }

    await addOutboxOp({
      id: "lock-op-1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "Locked", Author: "A" },
      createdAt: Date.now(),
    })

    let releaseExternal!: () => void
    const externalLock = locks.request("maktaba-drain", async () => {
      await new Promise<void>((resolve) => {
        releaseExternal = resolve
      })
    })

    const p1 = drainOutbox()
    const p2 = drainOutbox()
    const p3 = drainOutbox()
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(calls.length, 0)

    releaseExternal()
    await Promise.all([externalLock, p1, p2, p3])
    assert.equal(maxActiveCounts.get("maktaba-drain"), 1)
    assert.equal((await getOutbox()).length, 0)
  })

  it("bounds cross-ISBN concurrency to at most 2 in-flight writes", async () => {
    let active = 0
    let maxActive = 0
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "POST") {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 25))
        active -= 1
        const payload = JSON.parse(String(init?.body)) as { isbn?: string }
        return jsonResponse(bookBody(payload.isbn ?? ""), 201)
      }
      return jsonResponse([])
    }

    for (let i = 1; i <= 6; i++) {
      await addOutboxOp({
        id: `batch-${i}`,
        type: "create",
        isbn: `978000000000${i}`,
        payload: { Title: `Book ${i}`, Author: "A" },
        createdAt: Date.now() + i,
      })
    }

    const result = await drainOutbox()
    assert.equal(result.succeeded, 6)
    assert.equal((await getOutbox()).length, 0)
    assert.ok(maxActive >= 1 && maxActive <= 2, `maxActive was ${maxActive}`)
  })

  it("honors 429 Retry-After, keeps per-op error across pullRemoteCatalog, and recovers via retryOutboxNow", async () => {
    let fail429 = true
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "GET" && url === "/api/books") {
        return jsonResponse([])
      }
      if (method === "POST") {
        if (fail429) {
          return jsonResponse(
            { error: "Rate limited by Airtable." },
            429,
            { "Retry-After": "30" }
          )
        }
        const payload = JSON.parse(String(init?.body)) as { isbn?: string }
        return jsonResponse(bookBody(payload.isbn ?? ""), 201)
      }
      return jsonResponse([])
    }

    await addOutboxOp({
      id: "rl-1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "One", Author: "A" },
      createdAt: Date.now(),
    })
    await addOutboxOp({
      id: "rl-2",
      type: "create",
      isbn: "9780000000002",
      payload: { Title: "Two", Author: "B" },
      createdAt: Date.now() + 1,
    })

    const first = await drainOutbox()
    assert.equal(first.retryableRemaining, 2)
    const opsAfter429 = await getOutbox()
    const failedOp = opsAfter429.find((op) => op.lastStatus === 429)
    assert.ok(failedOp)
    assert.equal(failedOp.attempts, 1)
    assert.ok((failedOp.nextRetryAt ?? 0) > Date.now() + 10_000)

    await pullRemoteCatalog()
    const statusAfterPull = await readSyncStatus()
    assert.match(statusAfterPull.lastError ?? "", /Rate limited/i)

    fail429 = false
    const postsBefore = calls.filter((c) => c.method === "POST").length
    await drainOutbox()
    const postsAfter = calls.filter((c) => c.method === "POST").length
    assert.equal(postsAfter, postsBefore)

    const forced = await retryOutboxNow()
    assert.equal(forced.succeeded, 2)
    assert.equal((await getOutbox()).length, 0)
  })

  it("retries 401/403/408/504/TimeoutError/empty-200 while persisting per-op errors", async () => {
    const responses: Array<() => Response> = [
      () => jsonResponse({ error: "unauthorized" }, 401),
      () => jsonResponse({ error: "forbidden" }, 403),
      () => jsonResponse({ error: "gateway timeout" }, 408),
      () => jsonResponse({ error: "airtable timeout" }, 504),
      () => new Response("", { status: 200 }),
    ]
    let step = 0
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "POST") {
        if (step < responses.length) {
          return responses[step++]()
        }
        const err = new Error("Request timed out.")
        err.name = "TimeoutError"
        throw err
      }
      return jsonResponse([])
    }

    await addOutboxOp({
      id: "retry-matrix",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "Resilient", Author: "A" },
      createdAt: Date.now(),
    })

    for (let i = 0; i < responses.length + 1; i++) {
      const res = await drainOutbox()
      assert.equal(res.retryableRemaining, 1)
    }

    const [op] = await getOutbox()
    assert.equal(op?.attempts, responses.length + 1)
    assert.match(op?.lastError ?? "", /timed out/i)
  })

  it("pauses ISBN-only 404 create and 422 errors, then syncs after adding Title", async () => {
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method })
      if (method === "POST") {
        const body = JSON.parse(String(init?.body)) as {
          isbn?: string
          Title?: string
        }
        if (!body.Title) {
          return jsonResponse({ error: "Book not found" }, 404)
        }
        if (body.isbn === "9780000000002") {
          return jsonResponse({ error: "Invalid option" }, 422)
        }
        return jsonResponse(bookBody(body.isbn ?? "", body.Title), 201)
      }
      return jsonResponse([])
    }

    await createLocalBook("9780000000001")
    await createLocalBook("9780000000002", { Title: "Schema Mismatch" })
    const res = await drainOutbox()
    assert.equal(res.pausedRemaining, 2)
    assert.equal(res.retryableRemaining, 0)

    await drainOutboxForBackgroundSync()

    await updateLocalBook("9780000000001", { Title: "Manual Recovery Title" })
    const ops = await settledOutbox()
    assert.deepEqual(
      ops.map((op) => op.isbn),
      ["9780000000002"]
    )
    const recovered = await getBookByIsbn("9780000000001")
    assert.equal(recovered?.Title, "Manual Recovery Title")
    assert.equal(recovered?.pending, false)
  })

  it("drops verified update-404 ops and reconciles local book state", async () => {
    await putBook({
      ...bookBody("9780000000001", "Original", "rec_1"),
      pending: false,
    })
    await addOutboxOp({
      id: "stale-update",
      type: "update",
      isbn: "9780000000001",
      payload: { Status: "Done" },
      createdAt: Date.now(),
    })

    globalThis.fetch = async (_input, init) => {
      const method = init?.method ?? "GET"
      if (method === "PATCH") {
        return jsonResponse({ error: "Book not in library" }, 404)
      }
      return jsonResponse([])
    }

    await drainOutbox()
    assert.equal((await getOutbox()).length, 0)
    const book = await getBookByIsbn("9780000000001")
    assert.equal(book?.pending, false)
  })

  it("handles 409 create merge with existing.id, empty-value payloads, and inner 404 retry", async () => {
    let innerNotFound = true
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method, headers: init?.headers, body: String(init?.body ?? "") })
      if (method === "POST") {
        return jsonResponse({ error: "exists" }, 409)
      }
      if (method === "GET" && url === "/api/books/9780000000001") {
        if (innerNotFound) {
          return jsonResponse({ error: "gone" }, 404)
        }
        return jsonResponse(bookBody("9780000000001", "Server Title", "rec_existing"))
      }
      if (method === "GET" && url === "/api/books/9780000000002") {
        return jsonResponse(bookBody("9780000000002", "Existing Two", "rec_two"))
      }
      if (method === "PATCH" && url === "/api/books/9780000000001") {
        const headerId = (init?.headers as Record<string, string>)?.[
          "x-record-id"
        ]
        assert.equal(headerId, "rec_existing")
        return jsonResponse(bookBody("9780000000001", "Wanted", "rec_existing"))
      }
      return jsonResponse([])
    }

    await addOutboxOp({
      id: "c-409-1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "Wanted" },
      createdAt: Date.now(),
    })
    const r1 = await drainOutbox()
    assert.equal(r1.retryableRemaining, 1)

    innerNotFound = false
    const r2 = await drainOutbox()
    assert.equal(r2.succeeded, 1)

    await addOutboxOp({
      id: "c-409-2",
      type: "create",
      isbn: "9780000000002",
      payload: { Title: undefined },
      createdAt: Date.now() + 10,
    })
    const r3 = await drainOutbox()
    assert.equal(r3.succeeded, 1)
    assert.equal(
      calls.some((c) => c.method === "PATCH" && c.url.includes("9780000000002")),
      false
    )
  })

  it("preserves locally re-added books on delete and cleans non-pending tombstones on catalog sync", async () => {
    await putBook({
      ...bookBody("9780000000001", "Re-added", "rec_1"),
      deleted: false,
      pending: true,
    })
    await addOutboxOp({
      id: "del-1",
      type: "delete",
      isbn: "9780000000001",
      createdAt: Date.now(),
    })
    await addOutboxOp({
      id: "readd-1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "Re-added", Author: "A" },
      createdAt: Date.now() + 1,
    })

    globalThis.fetch = async (_input, init) => {
      const method = init?.method ?? "GET"
      if (method === "DELETE") {
        return jsonResponse({ error: "not found" }, 404)
      }
      if (method === "POST") {
        return jsonResponse(bookBody("9780000000001", "Re-added", "rec_new"), 201)
      }
      return jsonResponse([])
    }

    await drainOutbox()
    assert.equal((await getOutbox()).length, 0)
    const local = await getBookByIsbn("9780000000001")
    assert.equal(local?.id, "rec_new")
    assert.equal(local?.deleted, false)

    await putBook({
      ...bookBody("9780000000002", "Tombstone", "rec_old"),
      deleted: true,
      pending: true,
    })
    await upsertRemoteBook(bookBody("9780000000002", "Server Alive", "rec_old"), {
      preserveLocal: true,
    })
    assert.equal((await getBookByIsbn("9780000000002"))?.deleted, true)

    await replaceRemoteCatalog([])
    assert.equal(await getBookByIsbn("9780000000002"), undefined)
  })

  it("rejects drainOutboxForBackgroundSync on retryable errors and resolves when clear", async () => {
    let fail = true
    globalThis.fetch = async (input, init) => {
      const method = init?.method ?? "GET"
      if (method === "POST") {
        return fail
          ? jsonResponse({ error: "offline" }, 503)
          : jsonResponse(bookBody("9780000000001", "BG Sync"), 201)
      }
      return jsonResponse([])
    }

    await addOutboxOp({
      id: "bg-1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "BG Sync", Author: "A" },
      createdAt: Date.now(),
    })

    await assert.rejects(() => drainOutboxForBackgroundSync(), /Deferred sync/)

    fail = false
    await drainOutboxForBackgroundSync()
    assert.equal((await getOutbox()).length, 0)
  })

  it("prevents replaceOutboxOrder from resurrecting deleted ops or inverting same-ISBN order", async () => {
    const base = Date.now()
    await addOutboxOp({
      id: "op-a1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "First" },
      createdAt: base + 1,
    })
    await addOutboxOp({
      id: "op-b1",
      type: "create",
      isbn: "9780000000002",
      payload: { Title: "Middle" },
      createdAt: base + 2,
    })
    await addOutboxOp({
      id: "op-a2",
      type: "update",
      isbn: "9780000000001",
      payload: { Status: "Done" },
      createdAt: base + 3,
    })

    await removeOutboxOp("op-b1")
    await replaceOutboxOrder(["op-a2", "op-b1", "op-a1"])

    const ops = await getOutbox()
    assert.deepEqual(
      ops.map((op) => op.id),
      ["op-a1", "op-a2"]
    )
  })

  it("uses generous timeout budgets well above 2.5s for mobile/cold-start resilience", () => {
    assert.ok(CATALOG_BUDGET_MS >= 15_000)
    assert.ok(SYNC_WRITE_BUDGET_MS >= 15_000)
    assert.ok(SYNC_LOOKUP_CREATE_BUDGET_MS >= 20_000)
  })

  it("retries only the targeted paused op on retryOutboxNow(opId) without touching unrelated paused ops", async () => {
    const base = Date.now()
    await addOutboxOp({
      id: "paused-1",
      type: "create",
      isbn: "9780000000001",
      payload: { Title: "Fixable" },
      createdAt: base + 1,
      paused: true,
      attempts: 1,
      lastStatus: 422,
      lastError: "Original error 1",
    })
    await addOutboxOp({
      id: "paused-2",
      type: "create",
      isbn: "9780000000002",
      createdAt: base + 2,
      paused: true,
      attempts: 1,
      lastStatus: 404,
      lastError: "Original error 2",
    })

    const posted: string[] = []
    globalThis.fetch = async (input, init) => {
      const method = init?.method ?? "GET"
      if (method === "POST") {
        const body = JSON.parse(String(init?.body)) as { isbn?: string; Title?: string }
        posted.push(body.isbn ?? "")
        return jsonResponse(bookBody(body.isbn ?? "", body.Title), 201)
      }
      return jsonResponse([])
    }

    await retryOutboxNow("paused-1")
    assert.deepEqual(posted, ["9780000000001"])
    const remaining = await getOutbox()
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0].id, "paused-2")
    assert.equal(remaining[0].paused, true)
    assert.equal(remaining[0].lastError, "Original error 2")
  })

  it("keeps update/delete/ISBN-only ops retryable on non-JSON proxy 404/409 HTML pages", async () => {
    await putBook({
      ...bookBody("9780000000001", "Synced Book", "rec_1"),
      pending: false,
    })
    await addOutboxOp({
      id: "html-404-update",
      type: "update",
      isbn: "9780000000001",
      payload: { Status: "Done" },
      createdAt: Date.now() + 1,
    })
    await addOutboxOp({
      id: "html-404-create",
      type: "create",
      isbn: "9780000000002",
      createdAt: Date.now() + 2,
    })

    globalThis.fetch = async () =>
      new Response("<html><body>404 Proxy</body></html>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      })

    const result = await drainOutbox()
    assert.equal(result.retryableRemaining, 2)
    assert.equal(result.pausedRemaining, 0)
    const ops = await getOutbox()
    assert.equal(ops.length, 2)
    assert.equal(ops.every((op) => !op.paused), true)
  })
})
