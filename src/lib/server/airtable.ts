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

class AirtableRequestError extends Error {
  status: number
  error: { message: string; type?: string }

  constructor(status: number, message: string, type?: string) {
    super(message)
    this.name = "AirtableRequestError"
    this.status = status
    this.error = { message, type }
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

async function airtableFetch(
  url: string,
  init: RequestInit,
  attempt = 0
): Promise<unknown> {
  const { apiKey } = credentials()
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  })

  if (response.status === 429 && attempt < 4) {
    const retryAfter = Number(response.headers.get("Retry-After"))
    const waitMs = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : 200 * 2 ** attempt
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    return airtableFetch(url, init, attempt + 1)
  }

  const text = await response.text()
  let body: Record<string, unknown> | null = null
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new AirtableRequestError(
        response.status,
        text.slice(0, 200) || `Airtable request failed (${response.status}).`
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

  return body
}

async function listPage(
  tableName: string,
  options: SelectOptions = {},
  offset?: string
) {
  const url = new URL(recordsUrl(tableName))
  if (options.filterByFormula) {
    url.searchParams.set("filterByFormula", options.filterByFormula)
  }
  if (options.maxRecords) {
    url.searchParams.set("maxRecords", String(options.maxRecords))
  }
  if (offset) url.searchParams.set("offset", offset)

  const body = (await airtableFetch(url.toString(), { method: "GET" })) as {
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
          const page = await listPage(tableName, options)
          return page.records
        },
        all: async () => {
          const records: AirtableRecord[] = []
          let offset: string | undefined
          do {
            const page = await listPage(tableName, options, offset)
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
        body: JSON.stringify({ fields }),
      })) as AirtableRecordJson
      return new AirtableRecord(body)
    },
    async create(fields: FieldSet) {
      const body = (await airtableFetch(recordsUrl(tableName), {
        method: "POST",
        body: JSON.stringify({ fields }),
      })) as AirtableRecordJson
      return new AirtableRecord(body)
    },
  }
}

export function getAirtableBase() {
  return (tableName: string) => table(tableName)
}
