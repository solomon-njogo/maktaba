import "fake-indexeddb/auto"

import assert from "node:assert/strict"
import { after, afterEach, beforeEach, describe, it } from "node:test"

import { createLocalBook } from "./books-repository.ts"
import {
  addOutboxOp,
  clearOutbox,
  deleteBookRecord,
  getDb,
  getOutbox,
} from "./db.ts"
import { drainOutbox, hydrateLibrary, readSyncStatus } from "./sync.ts"

Object.defineProperty(navigator, "onLine", {
  configurable: true,
  value: true,
})

type Call = { url: string; method: string }

const calls: Call[] = []
let restoreFetch: (() => void) | undefined

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function bookBody(isbn: string, title = "Queue Probe") {
  return {
    id: "rec_probe",
    Title: title,
    Author: "Probe",
    ISBN: isbn,
    Status: "TBR",
    Borrowed: "No",
    inLibrary: true,
  }
}

beforeEach(() => {
  calls.length = 0
  const previous = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    calls.push({ url, method })
    if (method === "GET" && url.startsWith("/api/books")) return jsonResponse([])
    if (method === "POST" && url === "/api/books") {
      const payload = JSON.parse(String(init?.body)) as { isbn?: string; Title?: string }
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
  await clearOutbox()
  await deleteBookRecord("9780000000001")
  await deleteBookRecord("9780000000002")
})

after(async () => {
  const db = await getDb()
  db.close()
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
    assert.deepEqual(ops.map((op) => op.isbn), [])
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
      assert.deepEqual(ops.map((op) => op.isbn), [])
    } finally {
      releaseCatalog?.()
      await Promise.race([
        syncing,
        new Promise((resolve) => setTimeout(resolve, 50)),
      ])
    }
  })
})
