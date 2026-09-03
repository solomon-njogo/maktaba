import type { FieldSet, Record as AirtableRecord } from "airtable"

import type {
  BookCreatePayload,
  BookStatus,
  BookUpdatePayload,
  BorrowedFlag,
  FormattedBookResponse,
  GoogleBooksResponse,
  GoogleBooksVolumeInfo,
  OpenLibraryResponse,
} from "@/types/books"
import { cleanIsbnString } from "@/lib/isbn"

import { getAirtableBase } from "./airtable"
import { HttpError } from "./http-error"

export { cleanIsbnString }

const TABLE_NAME = "Books"
const VALID_STATUSES: BookStatus[] = ["Reading", "Done", "TBR", "To-Buy"]
const DATE_ADDED_FIELDS = ["Date Added", "DateAdded"] as const
const START_DATE_FIELDS = ["Start Date", "StartDate"] as const
const END_DATE_FIELDS = ["End Date", "EndDate"] as const
const BORROWED_BY_FIELDS = ["Borrowed By", "BorrowedBy"] as const
const BORROWED_ON_FIELDS = ["BorrowedOn", "Borrowed On"] as const
const BORROWED_UNTIL_FIELDS = ["BorrowedUntil", "Borrowed Until"] as const
const DELETED_AT_FIELDS = ["DeletedAt", "Deleted At"] as const

const FIELD_ALIASES: Record<string, string> = Object.fromEntries(
  [
    DATE_ADDED_FIELDS,
    START_DATE_FIELDS,
    END_DATE_FIELDS,
    BORROWED_BY_FIELDS,
    BORROWED_ON_FIELDS,
    BORROWED_UNTIL_FIELDS,
    DELETED_AT_FIELDS,
  ].flatMap(([preferred, fallback]) => [
    [preferred, fallback],
    [fallback, preferred],
  ])
)

type AttachmentLike = { url?: string }

function escapeAirtableString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

function isbnFormula(isbn: string): string {
  return `{ISBN} = '${escapeAirtableString(isbn)}'`
}

const OPEN_LIBRARY_TIMEOUT_MS = 4_000
const GOOGLE_BOOKS_TIMEOUT_MS = 10_000

const CATALOG_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Maktaba/1.0 (https://github.com/solomon-njogo/maktaba)",
}

function coverUrlFromIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
}

function toHttpsUrl(value: string): string {
  return value.replace(/^http:\/\//i, "https://")
}

function googleBooksCover(info: GoogleBooksVolumeInfo): string | undefined {
  const links = info.imageLinks
  if (!links) return undefined
  const url =
    links.extraLarge ??
    links.large ??
    links.medium ??
    links.small ??
    links.thumbnail ??
    links.smallThumbnail
  return url ? toHttpsUrl(url) : undefined
}

async function fetchJson(
  url: string,
  source: string,
  timeoutMs: number
): Promise<{ ok: true; data: unknown } | { ok: false; unavailable: true }> {
  try {
    const apiResponse = await fetch(url, {
      headers: CATALOG_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!apiResponse.ok) {
      console.warn(`${source} responded with status ${apiResponse.status}`)
      return { ok: false, unavailable: true }
    }
    return { ok: true, data: await apiResponse.json() }
  } catch (error: unknown) {
    console.warn(
      `${source} is unreachable${error instanceof Error ? `: ${error.message}` : "."}`
    )
    return { ok: false, unavailable: true }
  }
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean)
  }
  if (typeof value === "string" && value.trim()) {
    return [value]
  }
  return []
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

function thumbnailFromField(value: unknown, isbn?: string): string | undefined {
  if (typeof value === "string" && value) return value
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as AttachmentLike | string
    if (typeof first === "string") return first
    if (first && typeof first === "object" && first.url) return first.url
  }
  if (isbn) return coverUrlFromIsbn(isbn)
  return undefined
}

function isDeleted(deletedAt: unknown): boolean {
  return Boolean(asOptionalString(deletedAt))
}

function firstNamedField(
  record: AirtableRecord<FieldSet>,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = asOptionalString(record.get(name))
    if (value) return value
  }
  return undefined
}

function toAirtableDate(value: string | undefined): string | null {
  if (value == null) return null
  const iso = value.trim().slice(0, 10)
  if (!iso) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return iso
}

function firstDateField(
  record: AirtableRecord<FieldSet>,
  names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = record.get(name)
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10)
    }
    const date = toAirtableDate(asOptionalString(value))
    if (date) return date
  }
  return undefined
}

function setAliased(
  fields: FieldSet,
  names: readonly string[],
  value: string | null
) {
  ;(fields as Record<string, unknown>)[names[0]] = value
}

function setAliasedIfFilled(
  fields: FieldSet,
  names: readonly string[],
  value: string | undefined
) {
  if (value === undefined) return
  const trimmed = value.trim()
  if (!trimmed) return
  setAliased(fields, names, trimmed)
}

function setDateAliased(
  fields: FieldSet,
  names: readonly string[],
  value: string | undefined
) {
  const date = toAirtableDate(value)
  if (!date) return
  setAliased(fields, names, date)
}

function clearBorrowedPerson(fields: FieldSet) {
  setAliased(fields, BORROWED_BY_FIELDS, null)
  setAliased(fields, BORROWED_ON_FIELDS, null)
  setAliased(fields, BORROWED_UNTIL_FIELDS, null)
}

function formatRecord(
  record: AirtableRecord<FieldSet>,
  inLibrary: boolean
): FormattedBookResponse {
  const isbn =
    asOptionalString(record.get("ISBN")) ??
    asStringArray(record.get("ISBN13"))[0] ??
    asStringArray(record.get("ISBN10"))[0]
  const status = (asOptionalString(record.get("Status")) as BookStatus) || "TBR"
  const thumbnail = thumbnailFromField(record.get("Thumbnail"), isbn)

  return {
    id: record.id,
    Title: asOptionalString(record.get("Title")) ?? "Untitled",
    Author: asOptionalString(record.get("Author")) ?? "",
    ISBN: isbn,
    Status: VALID_STATUSES.includes(status) ? status : "TBR",
    StartDate: firstDateField(record, START_DATE_FIELDS),
    EndDate: firstDateField(record, END_DATE_FIELDS),
    Borrowed: (asOptionalString(record.get("Borrowed")) as BorrowedFlag) || "No",
    BorrowedBy: firstNamedField(record, BORROWED_BY_FIELDS),
    BorrowedOn: firstDateField(record, BORROWED_ON_FIELDS),
    BorrowedUntil: firstDateField(record, BORROWED_UNTIL_FIELDS),
    DateAdded:
      firstDateField(record, DATE_ADDED_FIELDS) ??
      asOptionalString(record._rawJson?.createdTime)?.slice(0, 10),
    Genre: asOptionalString(record.get("Genre")),
    Thumbnail: thumbnail,
    coverUrl: thumbnail,
    inLibrary,
  }
}

async function findRecordsByIsbn(isbn: string) {
  return getAirtableBase()(TABLE_NAME)
    .select({
      filterByFormula: isbnFormula(isbn),
      maxRecords: 5,
    })
    .firstPage()
}

async function findActiveRecordByIsbn(
  isbn: string
): Promise<AirtableRecord<FieldSet> | null> {
  const records = await findRecordsByIsbn(isbn)
  return (
    records.find((record) => !isDeleted(firstNamedField(record, DELETED_AT_FIELDS))) ??
    null
  )
}

export async function listBooks(filters?: {
  status?: string
  borrowed?: string
}): Promise<FormattedBookResponse[]> {
  const clauses: string[] = []

  if (filters?.status) {
    if (!VALID_STATUSES.includes(filters.status as BookStatus)) {
      throw new HttpError(400, "Invalid status filter.")
    }
    clauses.push(`{Status} = '${escapeAirtableString(filters.status)}'`)
  }

  if (filters?.borrowed) {
    const borrowed =
      filters.borrowed === "Yes" || filters.borrowed === "true"
        ? "Yes"
        : filters.borrowed === "No" || filters.borrowed === "false"
          ? "No"
          : null
    if (!borrowed) {
      throw new HttpError(400, "Invalid borrowed filter. Use Yes or No.")
    }
    clauses.push(`{Borrowed} = '${borrowed}'`)
  }

  const query = getAirtableBase()(TABLE_NAME).select(
    clauses.length > 0 ? { filterByFormula: `AND(${clauses.join(",")})` } : {}
  )
  const records = await query.all()

  return records
    .filter((record) => !isDeleted(firstNamedField(record, DELETED_AT_FIELDS)))
    .map((record) => formatRecord(record, true))
    .sort((a, b) => (b.DateAdded ?? "").localeCompare(a.DateAdded ?? ""))
}

type CatalogLookup = {
  book: FormattedBookResponse | null
  unavailable: boolean
}

export async function fetchBookFromOpenLibrary(
  isbn: string
): Promise<CatalogLookup> {
  const cleanIsbn = cleanIsbnString(isbn)
  const isbnKey = `ISBN:${cleanIsbn}`
  const url = `https://openlibrary.org/api/books?bibkeys=${isbnKey}&jscmd=details&format=json`
  const result = await fetchJson(url, "Open Library", OPEN_LIBRARY_TIMEOUT_MS)
  if (!result.ok) return { book: null, unavailable: true }

  const data = result.data as OpenLibraryResponse
  if (!data?.[isbnKey]?.details) return { book: null, unavailable: false }

  const details = data[isbnKey].details
  if (!details.title) return { book: null, unavailable: false }

  const thumbnail = coverUrlFromIsbn(cleanIsbn)
  return {
    book: {
      Title: details.title,
      Author: details.authors?.map((author) => author.name).join(", ") ?? "",
      ISBN: cleanIsbn,
      Status: "TBR",
      Borrowed: "No",
      Genre: undefined,
      Thumbnail: thumbnail,
      coverUrl: thumbnail,
      inLibrary: false,
    },
    unavailable: false,
  }
}

export async function fetchBookFromGoogleBooks(
  isbn: string
): Promise<CatalogLookup> {
  const cleanIsbn = cleanIsbnString(isbn)
  const params = new URLSearchParams({ q: `isbn:${cleanIsbn}` })
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim()
  if (apiKey) {
    params.set("key", apiKey)
  } else {
    console.warn(
      "GOOGLE_BOOKS_API_KEY is not set. Unauthenticated Google Books requests are often rate-limited (429)."
    )
  }

  const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`
  const result = await fetchJson(url, "Google Books", GOOGLE_BOOKS_TIMEOUT_MS)
  if (!result.ok) return { book: null, unavailable: true }

  const data = result.data as GoogleBooksResponse
  const info = data.items?.find((item) => item.volumeInfo?.title)?.volumeInfo
  if (!info?.title) return { book: null, unavailable: false }

  const thumbnail = googleBooksCover(info) ?? coverUrlFromIsbn(cleanIsbn)
  return {
    book: {
      Title: info.title,
      Author: info.authors?.join(", ") ?? "",
      ISBN: cleanIsbn,
      Status: "TBR",
      Borrowed: "No",
      Genre: info.categories?.[0],
      Thumbnail: thumbnail,
      coverUrl: thumbnail,
      inLibrary: false,
    },
    unavailable: false,
  }
}

function catalogUnavailableError() {
  const hasGoogleKey = Boolean(process.env.GOOGLE_BOOKS_API_KEY?.trim())
  return new HttpError(
    502,
    hasGoogleKey
      ? "Open Library and Google Books are unavailable. Try again shortly."
      : "Google Books is rate-limited and Open Library is unreachable. Set GOOGLE_BOOKS_API_KEY."
  )
}

async function fetchBookFromCatalogs(
  isbn: string
): Promise<FormattedBookResponse> {
  const lookups = [
    fetchBookFromGoogleBooks(isbn),
    fetchBookFromOpenLibrary(isbn),
  ]

  return new Promise((resolve, reject) => {
    let pending = lookups.length
    let anyCatalogResponded = false
    let settled = false

    for (const lookup of lookups) {
      lookup
        .then(({ book, unavailable }) => {
          if (settled) return
          if (book) {
            settled = true
            resolve(book)
            return
          }
          if (!unavailable) anyCatalogResponded = true
          pending -= 1
          if (pending === 0) {
            reject(
              anyCatalogResponded
                ? new HttpError(404, `Book with ISBN ${isbn} not found.`)
                : catalogUnavailableError()
            )
          }
        })
        .catch((error: unknown) => {
          if (settled) return
          pending -= 1
          if (pending === 0) {
            reject(
              anyCatalogResponded
                ? new HttpError(404, `Book with ISBN ${isbn} not found.`)
                : error instanceof HttpError
                  ? error
                  : catalogUnavailableError()
            )
          }
        })
    }
  })
}

export async function lookupIsbn(isbn: string): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  if (!cleanIsbn) {
    throw new HttpError(400, "A valid ISBN is required.")
  }

  const existing = await findActiveRecordByIsbn(cleanIsbn)
  if (existing) {
    return formatRecord(existing, true)
  }

  return fetchBookFromCatalogs(cleanIsbn)
}

export async function getLibraryBookByIsbn(
  isbn: string
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  const existing = await findActiveRecordByIsbn(cleanIsbn)
  if (!existing) {
    throw new HttpError(
      404,
      `Book with ISBN ${cleanIsbn} is not in the library.`
    )
  }
  return formatRecord(existing, true)
}

function fieldsFromPreview(
  preview: FormattedBookResponse,
  isbn: string
): FieldSet {
  const fields: FieldSet = {
    Title: preview.Title,
    Author: preview.Author,
    ISBN: isbn,
    Status: "TBR",
    Borrowed: "No",
  }

  if (preview.Genre) fields.Genre = preview.Genre
  if (preview.coverUrl) {
    fields.Thumbnail = [
      { url: preview.coverUrl },
    ] as unknown as FieldSet["Thumbnail"]
  }

  return fields
}

function fieldsFromManual(isbn: string, extras: BookCreatePayload): FieldSet {
  const title = extras.Title?.trim()
  if (!title) {
    throw new HttpError(400, "Title is required.")
  }
  if (extras.Status && !VALID_STATUSES.includes(extras.Status)) {
    throw new HttpError(400, "Invalid status.")
  }
  if (extras.Borrowed && extras.Borrowed !== "Yes" && extras.Borrowed !== "No") {
    throw new HttpError(400, "Borrowed must be Yes or No.")
  }

  const fields: FieldSet = {
    Title: title,
    Author: extras.Author?.trim() ?? "",
    ISBN: isbn,
    Status: extras.Status ?? "TBR",
    Borrowed: extras.Borrowed ?? "No",
  }

  if (extras.Genre !== undefined) fields.Genre = extras.Genre.trim()
  setDateAliased(fields, START_DATE_FIELDS, extras.StartDate)
  setDateAliased(fields, END_DATE_FIELDS, extras.EndDate)
  setAliasedIfFilled(fields, BORROWED_BY_FIELDS, extras.BorrowedBy)
  setDateAliased(fields, BORROWED_ON_FIELDS, extras.BorrowedOn)
  setDateAliased(fields, BORROWED_UNTIL_FIELDS, extras.BorrowedUntil)

  return fields
}

export async function createBook(
  isbn: string,
  extras?: BookCreatePayload
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  if (!cleanIsbn) {
    throw new HttpError(400, "A valid ISBN is required.")
  }

  const manual = Boolean(extras?.Title?.trim())

  const records = await findRecordsByIsbn(cleanIsbn)
  const active = records.find(
    (record) => !isDeleted(firstNamedField(record, DELETED_AT_FIELDS))
  )
  if (active) {
    throw new HttpError(
      409,
      `Book with ISBN ${cleanIsbn} is already in the library.`
    )
  }

  const deleted = records.find((record) =>
    isDeleted(firstNamedField(record, DELETED_AT_FIELDS))
  )
  if (deleted) {
    const restoredFields: FieldSet = manual
      ? { ...fieldsFromManual(cleanIsbn, extras ?? {}) }
      : {
          Status: "TBR",
          Borrowed: "No",
        }
    setAliased(restoredFields, DELETED_AT_FIELDS, null)
    if (!manual) clearBorrowedPerson(restoredFields)
    const restored = await applyRecordFields(restoredFields, deleted.id)
    return formatRecord(restored, true)
  }

  if (manual) {
    const created = await applyRecordFields(fieldsFromManual(cleanIsbn, extras ?? {}))
    return formatRecord(created, true)
  }

  const preview = await lookupIsbn(cleanIsbn)
  const created = await applyRecordFields(fieldsFromPreview(preview, cleanIsbn))
  return formatRecord(created, true)
}

export async function updateBook(
  isbn: string,
  patch: BookUpdatePayload
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  const existing = await findActiveRecordByIsbn(cleanIsbn)
  if (!existing) {
    throw new HttpError(
      404,
      `Book with ISBN ${cleanIsbn} is not in the library.`
    )
  }

  const fields: FieldSet = {}

  if (patch.Title !== undefined) {
    const title = patch.Title.trim()
    if (!title) {
      throw new HttpError(400, "Title is required.")
    }
    fields.Title = title
  }

  if (patch.Author !== undefined) {
    fields.Author = patch.Author.trim()
  }

  if (patch.Genre !== undefined) {
    fields.Genre = patch.Genre.trim()
  }

  if (patch.Status !== undefined) {
    if (!VALID_STATUSES.includes(patch.Status)) {
      throw new HttpError(400, "Invalid status.")
    }
    fields.Status = patch.Status
  }

  setDateAliased(fields, START_DATE_FIELDS, patch.StartDate)
  setDateAliased(fields, END_DATE_FIELDS, patch.EndDate)

  if (patch.Borrowed !== undefined) {
    if (patch.Borrowed !== "Yes" && patch.Borrowed !== "No") {
      throw new HttpError(400, "Borrowed must be Yes or No.")
    }
    fields.Borrowed = patch.Borrowed
    if (patch.Borrowed === "No") {
      clearBorrowedPerson(fields)
    }
  }

  setAliasedIfFilled(fields, BORROWED_BY_FIELDS, patch.BorrowedBy)
  setDateAliased(fields, BORROWED_ON_FIELDS, patch.BorrowedOn)
  setDateAliased(fields, BORROWED_UNTIL_FIELDS, patch.BorrowedUntil)

  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, "No valid fields to update.")
  }

  const updated = await applyRecordFields(fields, existing.id)
  return formatRecord(updated, true)
}

function airtableErrorTexts(error: unknown): string[] {
  const texts: string[] = []
  if (error instanceof Error) texts.push(error.message)
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    if (typeof record.message === "string") texts.push(record.message)
    if (record.error && typeof record.error === "object") {
      const inner = record.error as Record<string, unknown>
      if (typeof inner.message === "string") texts.push(inner.message)
    }
  }
  return texts
}

function unknownAirtableField(error: unknown): string | null {
  for (const text of airtableErrorTexts(error)) {
    const match = text.match(/Unknown field name: "([^"]+)"/)
    if (match?.[1]) return match[1]
  }
  return null
}

function emptyDateAirtableField(error: unknown): string | null {
  for (const text of airtableErrorTexts(error)) {
    const match = text.match(/Cannot parse date value "" for field (.+)$/)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

async function applyRecordFields(fields: FieldSet, existingId?: string) {
  const pending: FieldSet = { ...fields }
  const table = getAirtableBase()(TABLE_NAME)

  while (Object.keys(pending).length > 0) {
    try {
      return existingId
        ? await table.update(existingId, pending)
        : await table.create(pending)
    } catch (error) {
      const emptyDateField = emptyDateAirtableField(error)
      if (emptyDateField && emptyDateField in pending) {
        if (pending[emptyDateField] === "") {
          ;(pending as Record<string, unknown>)[emptyDateField] = null
          continue
        }
        delete pending[emptyDateField]
        continue
      }

      const name = unknownAirtableField(error)
      if (name && name in pending) {
        const alias = FIELD_ALIASES[name]
        if (alias && !(alias in pending)) {
          pending[alias] = pending[name]
        }
        delete pending[name]
        continue
      }
      throw error
    }
  }

  throw new HttpError(
    400,
    existingId ? "No valid fields to update." : "No valid fields to create."
  )
}

export async function softDeleteBook(
  isbn: string
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  const existing = await findActiveRecordByIsbn(cleanIsbn)
  if (!existing) {
    throw new HttpError(
      404,
      `Book with ISBN ${cleanIsbn} is not in the library.`
    )
  }

  const fields: FieldSet = {}
  setAliased(fields, DELETED_AT_FIELDS, new Date().toISOString())
  const updated = await applyRecordFields(fields, existing.id)
  return formatRecord(updated, false)
}

export function requireIsbn(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") {
    throw new HttpError(400, "A valid ISBN string parameter is required.")
  }
  const isbn = cleanIsbnString(raw)
  if (!isbn) {
    throw new HttpError(400, "A valid ISBN string parameter is required.")
  }
  return isbn
}
