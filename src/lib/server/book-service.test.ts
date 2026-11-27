import assert from "node:assert/strict"
import { after, afterEach, before, beforeEach, describe, it } from "node:test"

import type * as BookServiceModule from "./book.service.ts"
import { AirtableRequestError } from "./airtable.ts"
import { HttpError } from "./http-error.ts"
import { jsonError } from "./route-response.ts"

// Track fetch calls from module evaluation time to assert zero eager cold-start requests.
let eagerFetchCalls = 0
let __resetBookServiceForTests!: typeof BookServiceModule.__resetBookServiceForTests
let cleanIsbnString!: typeof BookServiceModule.cleanIsbnString
let createBook!: typeof BookServiceModule.createBook
let listBooks!: typeof BookServiceModule.listBooks
let softDeleteBook!: typeof BookServiceModule.softDeleteBook
let updateBook!: typeof BookServiceModule.updateBook

before(async () => {
  const originalFetchAtLoad = globalThis.fetch
  globalThis.fetch = async (...args) => {
    eagerFetchCalls += 1
    return originalFetchAtLoad(...args)
  }
  try {
    const mod = await import("./book.service.ts")
    __resetBookServiceForTests = mod.__resetBookServiceForTests
    cleanIsbnString = mod.cleanIsbnString
    createBook = mod.createBook
    listBooks = mod.listBooks
    softDeleteBook = mod.softDeleteBook
    updateBook = mod.updateBook
  } finally {
    globalThis.fetch = originalFetchAtLoad
  }
})

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

const savedEnv = {
  token: process.env.AIRTABLE_ACCESS_TOKEN,
  base: process.env.AIRTABLE_BASE_ID,
}

let restoreFetch: (() => void) | undefined

beforeEach(() => {
  process.env.AIRTABLE_ACCESS_TOKEN = "patTestToken"
  process.env.AIRTABLE_BASE_ID = "appTestBase"
  __resetBookServiceForTests()
})

afterEach(() => {
  restoreFetch?.()
  restoreFetch = undefined
  __resetBookServiceForTests()
})

after(() => {
  if (savedEnv.token === undefined) delete process.env.AIRTABLE_ACCESS_TOKEN
  else process.env.AIRTABLE_ACCESS_TOKEN = savedEnv.token
  if (savedEnv.base === undefined) delete process.env.AIRTABLE_BASE_ID
  else process.env.AIRTABLE_BASE_ID = savedEnv.base
})

describe("server book service & Airtable client", () => {
  it("makes zero fetch calls on module import", () => {
    assert.equal(eagerFetchCalls, 0)
  })

  it("uppercases lowercase x in cleanIsbnString", () => {
    assert.equal(cleanIsbnString("014-312-774x"), "014312774X")
  })

  it("breaks applyRecordFields alias ping-pong loops and caches missing columns", async () => {
    const patchPayloads: Array<Record<string, unknown>> = []
    const previous = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET") {
        return jsonResponse({
          records: [
            {
              id: "recValid1",
              fields: {
                Title: "Dune",
                Author: "Frank Herbert",
                ISBN: "9780441172719",
                Status: "Reading",
                Borrowed: "Yes",
              },
            },
          ],
        })
      }
      if (method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as {
          fields: Record<string, unknown>
          typecast?: boolean
        }
        assert.equal(body.typecast, true)
        patchPayloads.push(body.fields)

        for (const missing of [
          "Borrowed By",
          "BorrowedBy",
          "BorrowedOn",
          "Borrowed On",
          "BorrowedUntil",
          "Borrowed Until",
        ]) {
          if (missing in body.fields) {
            return jsonResponse(
              {
                error: {
                  type: "UNKNOWN_FIELD_NAME",
                  message: `Unknown field name: "${missing}"`,
                },
              },
              422
            )
          }
        }

        return jsonResponse({
          id: "recValid1",
          fields: {
            Title: "Dune",
            Author: "Frank Herbert",
            ISBN: "9780441172719",
            Status: body.fields.Status ?? "Done",
            Borrowed: body.fields.Borrowed ?? "No",
          },
        })
      }
      return jsonResponse({ error: `unexpected ${method} ${url}` }, 500)
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    const updated = await updateBook("9780441172719", {
      Status: "Done",
      Borrowed: "No",
    })
    assert.equal(updated.Status, "Done")
    assert.equal(updated.Borrowed, "No")
    assert.ok(
      patchPayloads.length <= 7,
      `expected bounded retries, got ${patchPayloads.length}`
    )

    const beforeSecond = patchPayloads.length
    await updateBook(
      "9780441172719",
      { Status: "TBR", Borrowed: "No" },
      "recValid1"
    )
    assert.equal(patchPayloads.length - beforeSecond, 1)
    assert.deepEqual(patchPayloads[patchPayloads.length - 1], {
      Status: "TBR",
      Borrowed: "No",
    })
  })

  it("caches resolved alias column names across subsequent writes", async () => {
    const patchBodies: Array<Record<string, unknown>> = []
    const previous = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      if (init?.method === "PATCH") {
        const parsed = JSON.parse(String(init.body)) as {
          fields: Record<string, unknown>
        }
        patchBodies.push(parsed.fields)
        if ("Start Date" in parsed.fields) {
          return jsonResponse(
            {
              error: {
                type: "UNKNOWN_FIELD_NAME",
                message: 'Unknown field name: "Start Date"',
              },
            },
            422
          )
        }
        return jsonResponse({
          id: "recAlias1",
          fields: {
            Title: "Alias Book",
            ISBN: "9780000000001",
            Status: "Reading",
            StartDate: parsed.fields.StartDate,
          },
        })
      }
      return jsonResponse({ records: [] })
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    await updateBook(
      "9780000000001",
      { StartDate: "2026-10-01" },
      "recAlias1"
    )
    assert.equal(patchBodies.length, 2)
    assert.ok("StartDate" in patchBodies[1])

    await updateBook(
      "9780000000001",
      { StartDate: "2026-10-02" },
      "recAlias1"
    )
    assert.equal(patchBodies.length, 3)
    assert.ok("StartDate" in patchBodies[2])
    assert.equal("Start Date" in patchBodies[2], false)
  })

  it("sends typecast: true, omits blank Genre on create, sends null on update, and handles Thumbnail 422 fallback", async () => {
    const sentBodies: Array<{ method: string; body: Record<string, unknown> }> =
      []
    const previous = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (url.includes("openlibrary.org")) {
        return jsonResponse({
          "ISBN:9780000000002": {
            details: { title: "Preview Title", authors: [{ name: "Author" }] },
          },
        })
      }
      if (url.includes("googleapis.com")) {
        return jsonResponse({ items: [] })
      }
      if (method === "GET") {
        return jsonResponse({ records: [] })
      }
      const parsed = JSON.parse(String(init?.body)) as {
        fields: Record<string, unknown>
        typecast?: boolean
      }
      assert.equal(parsed.typecast, true)
      sentBodies.push({ method, body: parsed.fields })

      if (method === "POST" && Array.isArray(parsed.fields.Thumbnail)) {
        return jsonResponse(
          {
            error: {
              type: "INVALID_VALUE_FOR_COLUMN",
              message: "Invalid value for field Thumbnail",
            },
          },
          422
        )
      }

      return jsonResponse({
        id: "recCreated1",
        fields: {
          Title: parsed.fields.Title ?? "Manual",
          Author: parsed.fields.Author ?? "",
          ISBN: parsed.fields.ISBN ?? "9780000000001",
          Status: parsed.fields.Status ?? "TBR",
          Borrowed: "No",
          Thumbnail: parsed.fields.Thumbnail,
        },
      })
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    await createBook("9780000000001", {
      Title: "Manual",
      Author: "Writer",
      Genre: "   ",
    })
    assert.equal("Genre" in sentBodies[0].body, false)

    await updateBook(
      "9780000000001",
      { Genre: "" },
      "recCreated1"
    )
    assert.equal(sentBodies[1].body.Genre, null)

    const previewBook = await createBook("9780000000002")
    assert.equal(previewBook.Title, "Preview Title")
    assert.equal(typeof sentBodies[3].body.Thumbnail, "string")
  })

  it("fails fast on Airtable 429 with large Retry-After and retries 429 without Retry-After", async () => {
    let calls = 0
    const previous = globalThis.fetch
    globalThis.fetch = async () => {
      calls += 1
      return jsonResponse(
        { error: { message: "Too many requests" } },
        429,
        { "Retry-After": "30" }
      )
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    await assert.rejects(
      () => listBooks(),
      (err: unknown) =>
        err instanceof AirtableRequestError &&
        err.status === 429 &&
        err.retryAfterSeconds === 30
    )
    assert.equal(calls, 1)

    calls = 0
    __resetBookServiceForTests()
    globalThis.fetch = async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse({ error: { message: "Rate limit" } }, 429)
      }
      return jsonResponse({ records: [] })
    }

    const books = await listBooks()
    assert.deepEqual(books, [])
    assert.equal(calls, 2)
  })

  it("falls back to ISBN lookup when x-record-id returns 404 or 403 on update and delete", async () => {
    let patchAttempts = 0
    const previous = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (method === "GET") {
        return jsonResponse({
          records: [
            {
              id: "recReal123",
              fields: {
                Title: "Recovered",
                ISBN: "9780000000001",
                Status: "TBR",
                Borrowed: "No",
              },
            },
          ],
        })
      }
      if (method === "PATCH") {
        patchAttempts += 1
        if (url.endsWith("/recStale403")) {
          return jsonResponse({ error: { message: "Not found" } }, 403)
        }
        if (url.endsWith("/recStale404")) {
          return jsonResponse({ error: { message: "Not found" } }, 404)
        }
        const body = JSON.parse(String(init?.body)) as {
          fields: Record<string, unknown>
        }
        return jsonResponse({
          id: "recReal123",
          fields: {
            Title: "Recovered",
            ISBN: "9780000000001",
            Status: body.fields.Status ?? "TBR",
            Borrowed: "No",
            DeletedAt: body.fields.DeletedAt,
          },
        })
      }
      return jsonResponse({ error: "no" }, 500)
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    const updated = await updateBook(
      "9780000000001",
      { Status: "Reading" },
      "recStale403"
    )
    assert.equal(updated.id, "recReal123")
    assert.equal(updated.Status, "Reading")

    const deleted = await softDeleteBook("9780000000001", "recStale404")
    assert.equal(deleted.inLibrary, false)
    assert.equal(patchAttempts, 4)
  })

  it("checks Airtable live on createBook even after catalogCache loads and clears borrowed info on restoreDeleted", async () => {
    let stage = 0
    let restoredFields: Record<string, unknown> | undefined
    const previous = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const method = init?.method ?? "GET"
      if (method === "GET") {
        if (stage === 0) {
          return jsonResponse({ records: [] })
        }
        return jsonResponse({
          records: [
            {
              id: "recDeletedOld",
              fields: {
                Title: "Old",
                ISBN: "9780000000001",
                Status: "TBR",
                Borrowed: "Yes",
                BorrowedBy: "Alex",
                DeletedAt: "2026-10-01T00:00:00.000Z",
              },
            },
          ],
        })
      }
      if (method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as {
          fields: Record<string, unknown>
        }
        restoredFields = body.fields
        return jsonResponse({
          id: "recDeletedOld",
          fields: {
            Title: body.fields.Title,
            ISBN: "9780000000001",
            Status: "TBR",
            Borrowed: "No",
          },
        })
      }
      return jsonResponse({ error: "unexpected" }, 500)
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    assert.deepEqual(await listBooks(), [])
    stage = 1

    const restored = await createBook("9780000000001", {
      Title: "Restored Book",
      Borrowed: "No",
    })
    assert.equal(restored.Title, "Restored Book")
    assert.equal(restoredFields?.DeletedAt, null)
    assert.equal(restoredFields?.["Borrowed By"], null)
    assert.equal(restoredFields?.BorrowedOn, null)
    assert.equal(restoredFields?.BorrowedUntil, null)
  })

  it("overlays Status/Borrowed/Author/Genre/dates on ISBN-only createBook and restoreDeleted", async () => {
    const sentFields: Array<Record<string, unknown>> = []
    let stage = 0
    const previous = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      if (url.includes("openlibrary.org")) {
        return jsonResponse({
          "ISBN:9780000000003": {
            details: { title: "Catalog Title", authors: [{ name: "Catalog Author" }] },
          },
        })
      }
      if (url.includes("googleapis.com")) {
        return jsonResponse({ items: [] })
      }
      if (method === "GET") {
        if (stage === 0) return jsonResponse({ records: [] })
        return jsonResponse({
          records: [
            {
              id: "recSoftDel",
              fields: {
                Title: "Old Soft Deleted",
                ISBN: "9780000000004",
                Status: "TBR",
                Borrowed: "No",
                DeletedAt: "2026-10-01T00:00:00.000Z",
              },
            },
          ],
        })
      }
      const parsed = JSON.parse(String(init?.body)) as {
        fields: Record<string, unknown>
      }
      sentFields.push(parsed.fields)
      return jsonResponse({
        id: stage === 0 ? "recNew3" : "recSoftDel",
        fields: {
          Title: parsed.fields.Title ?? "Old Soft Deleted",
          Author: parsed.fields.Author ?? "",
          ISBN: stage === 0 ? "9780000000003" : "9780000000004",
          Status: parsed.fields.Status ?? "TBR",
          Borrowed: parsed.fields.Borrowed ?? "No",
          BorrowedBy: parsed.fields["Borrowed By"],
          StartDate: parsed.fields["Start Date"],
        },
      })
    }
    restoreFetch = () => {
      globalThis.fetch = previous
    }

    const created = await createBook("9780000000003", {
      Status: "Reading",
      StartDate: "2026-11-01",
      Borrowed: "Yes",
      BorrowedBy: "Sam",
    })
    assert.equal(created.Status, "Reading")
    assert.equal(sentFields[0].Status, "Reading")
    assert.equal(sentFields[0].Borrowed, "Yes")
    assert.equal(sentFields[0]["Borrowed By"], "Sam")
    assert.equal(sentFields[0]["Start Date"], "2026-11-01")

    stage = 1
    const restored = await createBook("9780000000004", {
      Status: "Done",
      EndDate: "2026-11-15",
    })
    assert.equal(restored.Status, "Done")
    assert.equal(sentFields[1].Status, "Done")
    assert.equal(sentFields[1]["End Date"], "2026-11-15")
    assert.equal(sentFields[1].DeletedAt, null)
  })

  it("maps AirtableRequestError and HttpError cleanly in route-response jsonError", async () => {
    const err401 = jsonError(new AirtableRequestError(401, "Invalid token"))
    assert.equal(err401.status, 502)

    const err403 = jsonError(new AirtableRequestError(403, "Forbidden"))
    assert.equal(err403.status, 502)

    const err404 = jsonError(new AirtableRequestError(404, "Base not found"))
    assert.equal(err404.status, 502)

    const err504 = jsonError(new AirtableRequestError(504, "Timeout"))
    assert.equal(err504.status, 504)

    const err408 = jsonError(new AirtableRequestError(408, "Request timeout"))
    assert.equal(err408.status, 504)

    const err429 = jsonError(
      new AirtableRequestError(429, "Slow down", "RATE_LIMITED", 30)
    )
    assert.equal(err429.status, 429)
    assert.equal(err429.headers.get("Retry-After"), "30")

    const err422 = jsonError(new AirtableRequestError(422, "Invalid option"))
    assert.equal(err422.status, 422)

    const app409 = jsonError(new HttpError(409, "Already in library"))
    assert.equal(app409.status, 409)
  })
})
