import { HttpError } from "./http-error"

export type FieldSet = Record<string, unknown>

type AirtableRecordJson = {
  id: string
  createdTime?: string
  fields?: FieldSet
}

export class AirtableRecord {
  id: string
  fields: FieldSet
  _rawJson: { createdTime?: string; fields: FieldSet }

  constructor(json: AirtableRecordJson) {
    this.id = json.id
    this.fields = json.fields ?? {}
    this._rawJson = {
      createdTime: json.createdTime,
      fields: this.fields,
    }
  }

  get(key: string): unknown {
    return this.fields[key]
  }
}

export class AirtableRequestError extends Error {
  status: number
  error: { message: string; type?: string }
  retryAfterSeconds?: number

  constructor(
    status: number,
    message: string,
    type?: string,
    retryAfterSeconds?: number
  ) {
    super(message)
    this.name = "AirtableRequestError"
    this.status = status
    this.error = { message, type }
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type SelectOptions = {
  filterByFormula?: string
  maxRecords?: number
}

type TableApi = {
  select(options?: SelectOptions): {
    firstPage(): Promise<AirtableRecord[]>
    all(): Promise<AirtableRecord[]>
  }
  update(id: string, fields: FieldSet): Promise<AirtableRecord>
  create(fields: FieldSet): Promise<AirtableRecord>
}

function credentials() {
  const apiKey = process.env.AIRTABLE_ACCESS_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID

  if (!apiKey || !baseId) {
    throw new HttpError(
      500,
      "Missing Airtable configuration. Set AIRTABLE_ACCESS_TOKEN and AIRTABLE_BASE_ID."
    )
  }

  return { apiKey, baseId }
}

function recordsUrl(tableName: string, recordId?: string) {
  const { baseId } = credentials()
  const path = recordId
    ? `${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`
    : encodeURIComponent(tableName)
  return `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${path}`
}

const WRITE_BUDGET_MS = 12_000
const READ_BUDGET_MS = 12_000
const LIST_ALL_BUDGET_MS = 15_000
const RATE_WINDOW_MS = 1000
const RATE_MAX_REQUESTS = 5

const requestTimestamps: number[] = []
let pacingChain: Promise<void> = Promise.resolve()

export function __resetAirtableForTests() {
  requestTimestamps.length = 0
}

function timeoutSignal(ms: number): {
  signal: AbortSignal
  cleanup: () => void
} {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return { signal: AbortSignal.timeout(Math.max(1, ms)), cleanup: () => {} }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => {
    const error = new Error("The operation was aborted due to timeout")
    error.name = "TimeoutError"
    controller.abort(error)
  }, Math.max(1, ms))
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  }
}

async function acquirePacingSlot(remaining: () => number): Promise<void> {
  const previous = pacingChain
  let release!: () => void
  pacingChain = new Promise<void>((resolve) => {
    release = resolve
  })
  await previous
  try {
    if (remaining() <= 0) {
      throw new AirtableRequestError(504, "Airtable took too long.")
    }
    const now = Date.now()
    while (
      requestTimestamps.length > 0 &&
      now - requestTimestamps[0] >= RATE_WINDOW_MS
    ) {
      requestTimestamps.shift()
    }
    if (requestTimestamps.length >= RATE_MAX_REQUESTS) {
      const oldest = requestTimestamps[0]
      const waitMs = Math.max(0, oldest + RATE_WINDOW_MS - now + 10)
      if (waitMs > 0) {
        if (remaining() - waitMs <= 100) {
          throw new AirtableRequestError(504, "Airtable took too long.")
        }
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
      const afterWait = Date.now()
      while (
        requestTimestamps.length > 0 &&
        afterWait - requestTimestamps[0] >= RATE_WINDOW_MS
      ) {
        requestTimestamps.shift()
      }
    }
    if (remaining() <= 0) {
      throw new AirtableRequestError(504, "Airtable took too long.")
    }
    requestTimestamps.push(Date.now())
  } finally {
    release()
  }
}

function parseRetryAfterSeconds(header: string | null): number {
  if (header === null || header.trim() === "") return NaN
  const numeric = Number(header)
  if (Number.isFinite(numeric) && numeric >= 0) return numeric
  const dateMs = Date.parse(header)
  if (Number.isFinite(dateMs)) {
    return Math.max(0, (dateMs - Date.now()) / 1000)
  }
  return NaN
}

async function airtableFetch(
  url: string,
  init: RequestInit,
  attempt = 0,
  started = Date.now(),
  budgetMs = WRITE_BUDGET_MS
): Promise<unknown> {
  const remaining = () => budgetMs - (Date.now() - started)
  if (remaining() <= 0) {
    throw new AirtableRequestError(504, "Airtable took too long.")
  }

  const { apiKey } = credentials()
  await acquirePacingSlot(remaining)
  if (remaining() <= 0) {
    throw new AirtableRequestError(504, "Airtable took too long.")
  }

  let response: Response
  let text: string
  const { signal, cleanup } = timeoutSignal(remaining())
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal,
    })
    text = await response.text()
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new AirtableRequestError(504, "Airtable took too long.")
    }
    throw error
  } finally {
    cleanup()
  }

  if (response.status === 429) {
    const retryAfterSec = parseRetryAfterSeconds(
      response.headers.get("Retry-After")
    )
    if (Number.isFinite(retryAfterSec) && retryAfterSec > 1.5) {
      throw new AirtableRequestError(
        429,
        "Airtable rate limit reached. Retrying shortly.",
        "RATE_LIMITED",
        Math.ceil(retryAfterSec)
      )
    }

    if (attempt < 2) {
      const desiredWaitMs =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : 400 * (attempt + 1)
      if (desiredWaitMs <= 1500 && remaining() - desiredWaitMs > 200) {
        await new Promise((resolve) => setTimeout(resolve, desiredWaitMs))
        return airtableFetch(url, init, attempt + 1, started, budgetMs)
      }
    }

    throw new AirtableRequestError(
      429,
      "Airtable rate limit reached. Retrying shortly.",
      "RATE_LIMITED",
      Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? Math.ceil(retryAfterSec)
        : 5
    )
  }

  let body: Record<string, unknown> | null = null
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      const snippet = text
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200)
      throw new AirtableRequestError(
        response.status,
        snippet || `Airtable request failed (${response.status}).`
      )
    }
  }

  if (!response.ok) {
    const nested =
      body && typeof body.error === "object" && body.error
        ? (body.error as Record<string, unknown>)
        : null
    const message =
      (typeof nested?.message === "string" && nested.message) ||
      (typeof body?.error === "string" && body.error) ||
      (typeof body?.message === "string" && body.message) ||
      `Airtable request failed (${response.status}).`
    const type = typeof nested?.type === "string" ? nested.type : undefined
    throw new AirtableRequestError(response.status, message, type)
  }

  if (!body) {
    throw new AirtableRequestError(502, "Airtable returned an empty response.")
  }

  return body
}

async function listPage(
  tableName: string,
  options: SelectOptions = {},
  offset?: string,
  started = Date.now(),
  budgetMs = READ_BUDGET_MS
) {
  const url = new URL(recordsUrl(tableName))
  if (options.filterByFormula) {
    url.searchParams.set("filterByFormula", options.filterByFormula)
  }
  if (options.maxRecords) {
    url.searchParams.set("maxRecords", String(options.maxRecords))
  }
  url.searchParams.set("pageSize", "100")
  if (offset) url.searchParams.set("offset", offset)

  const body = (await airtableFetch(
    url.toString(),
    { method: "GET" },
    0,
    started,
    budgetMs
  )) as {
    records?: AirtableRecordJson[]
    offset?: string
  }

  return {
    records: (body.records ?? []).map((record) => new AirtableRecord(record)),
    offset: body.offset,
  }
}

function table(tableName: string): TableApi {
  return {
    select(options: SelectOptions = {}) {
      return {
        firstPage: async () => {
          const page = await listPage(
            tableName,
            options,
            undefined,
            Date.now(),
            READ_BUDGET_MS
          )
          return page.records
        },
        all: async () => {
          const started = Date.now()
          const records: AirtableRecord[] = []
          let offset: string | undefined
          do {
            const page = await listPage(
              tableName,
              options,
              offset,
              started,
              LIST_ALL_BUDGET_MS
            )
            records.push(...page.records)
            offset = page.offset
          } while (offset)
          return records
        },
      }
    },
    async update(id: string, fields: FieldSet) {
      const body = (await airtableFetch(recordsUrl(tableName, id), {
        method: "PATCH",
        body: JSON.stringify({ fields, typecast: true }),
      })) as AirtableRecordJson
      return new AirtableRecord(body)
    },
    async create(fields: FieldSet) {
      const body = (await airtableFetch(recordsUrl(tableName), {
        method: "POST",
        body: JSON.stringify({ fields, typecast: true }),
      })) as AirtableRecordJson
      return new AirtableRecord(body)
    },
  }
}

export function getAirtableBase() {
  return (tableName: string) => table(tableName)
}
