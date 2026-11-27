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

import {
  __resetAirtableForTests,
  AirtableRecord,
  AirtableRequestError,
  getAirtableBase,
  type FieldSet,
} from "./airtable"
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

const ALIAS_GROUPS = [
  DATE_ADDED_FIELDS,
  START_DATE_FIELDS,
  END_DATE_FIELDS,
  BORROWED_BY_FIELDS,
  BORROWED_ON_FIELDS,
  BORROWED_UNTIL_FIELDS,
  DELETED_AT_FIELDS,
] as const

const FIELD_TO_GROUP = new Map<string, readonly [string, string]>()
const FIELD_ALIASES: Record<string, string> = {}
for (const group of ALIAS_GROUPS) {
  const [preferred, fallback] = group
  FIELD_TO_GROUP.set(preferred, group)
  FIELD_TO_GROUP.set(fallback, group)
  FIELD_ALIASES[preferred] = fallback
  FIELD_ALIASES[fallback] = preferred
}

const MISSING_FIELD_CACHE_TTL_MS = 5 * 60_000
const VALID_RECORD_ID = /^rec[a-zA-Z0-9]+$/

type ResolvedFieldEntry = { name: string | null; at: number }
const resolvedFieldNames = new Map<string, ResolvedFieldEntry>()
const inFlightCreates = new Map<string, Promise<void>>()

type AttachmentLike = { url?: string }

function escapeAirtableString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

function isbnFormula(isbn: string): string {
  return `{ISBN} = '${escapeAirtableString(isbn)}'`
}

const OPEN_LIBRARY_TIMEOUT_MS = 4_000
const GOOGLE_BOOKS_TIMEOUT_MS = 5_000

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
  record: AirtableRecord,
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
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }
  return iso
}

function firstDateField(
  record: AirtableRecord,
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

function observeRecordFields(record: AirtableRecord) {
  const keys = Object.keys(record.fields ?? {})
  if (keys.length === 0) return
  const now = Date.now()
  for (const group of ALIAS_GROUPS) {
    const canonical = group[0]
    for (const candidate of group) {
      if (keys.includes(candidate)) {
        resolvedFieldNames.set(canonical, { name: candidate, at: now })
        break
      }
    }
  }
}

function resolvedColumnName(canonical: string): string | null | undefined {
  const entry = resolvedFieldNames.get(canonical)
  if (!entry) return undefined
  if (entry.name === null && Date.now() - entry.at >= MISSING_FIELD_CACHE_TTL_MS) {
    resolvedFieldNames.delete(canonical)
    return undefined
  }
  return entry.name
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
  value: unknown,
  fieldLabel: string
) {
  if (value === undefined) return
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldLabel} must be a string.`)
  }
  const trimmed = value.trim()
  if (!trimmed) return
  setAliased(fields, names, trimmed)
}

function setDateAliasedCreate(
  fields: FieldSet,
  names: readonly string[],
  value: unknown,
  fieldLabel: string
) {
  if (value === undefined || value === null) return
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldLabel} must be a string.`)
  }
  if (!value.trim()) return
  const date = toAirtableDate(value)
  if (!date) {
    throw new HttpError(400, `Invalid ${fieldLabel} date. Use YYYY-MM-DD.`)
  }
  setAliased(fields, names, date)
}

function setDateAliasedUpdate(
  fields: FieldSet,
  names: readonly string[],
  value: unknown,
  fieldLabel: string
) {
  if (value === undefined) return
  if (value === null) {
    setAliased(fields, names, null)
    return
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${fieldLabel} must be a string.`)
  }
  if (!value.trim()) {
    setAliased(fields, names, null)
    return
  }
  const date = toAirtableDate(value)
  if (!date) {
    throw new HttpError(400, `Invalid ${fieldLabel} date. Use YYYY-MM-DD.`)
  }
  setAliased(fields, names, date)
}

function clearBorrowedPerson(fields: FieldSet) {
  setAliased(fields, BORROWED_BY_FIELDS, null)
  setAliased(fields, BORROWED_ON_FIELDS, null)
  setAliased(fields, BORROWED_UNTIL_FIELDS, null)
}

function formatRecord(
  record: AirtableRecord,
  inLibrary: boolean
): FormattedBookResponse {
  observeRecordFields(record)
  const rawIsbn =
    asOptionalString(record.get("ISBN")) ??
    asStringArray(record.get("ISBN13"))[0] ??
    asStringArray(record.get("ISBN10"))[0]
  const isbn = rawIsbn ? cleanIsbnString(rawIsbn) || rawIsbn : undefined
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
): Promise<AirtableRecord | null> {
  const records = await findRecordsByIsbn(isbn)
  return (
    records.find((record) => !isDeleted(firstNamedField(record, DELETED_AT_FIELDS))) ??
    null
  )
}

const CATALOG_FRESH_MS = 1000

let catalogCache: { at: number; books: FormattedBookResponse[] } | null = null
let catalogFlight: Promise<FormattedBookResponse[]> | null = null
let catalogEpoch = 0

function sortCatalog(books: FormattedBookResponse[]) {
  return [...books].sort((a, b) =>
    (b.DateAdded ?? "").localeCompare(a.DateAdded ?? "")
  )
}

function rememberBook(book: FormattedBookResponse) {
  catalogEpoch += 1
  if (!catalogCache) return
  const books = catalogCache.books.filter(
    (item) => item.ISBN !== book.ISBN && item.id !== book.id
  )
  if (book.inLibrary) books.push(book)
  catalogCache = { at: Date.now(), books: sortCatalog(books) }
}

function forgetBook(isbn: string, recordId?: string) {
  catalogEpoch += 1
  if (!catalogCache) return
  catalogCache = {
    at: Date.now(),
    books: catalogCache.books.filter(
      (item) => item.ISBN !== isbn && item.id !== recordId
    ),
  }
}

async function fetchCatalog(): Promise<FormattedBookResponse[]> {
  const records = await getAirtableBase()(TABLE_NAME).select().all()
  const books: FormattedBookResponse[] = []
  for (const record of records) {
    const book = formatRecord(record, true)
    if (isDeleted(firstNamedField(record, DELETED_AT_FIELDS))) {
      continue
    }
    books.push(book)
  }
  return sortCatalog(books)
}

async function refreshCatalog(): Promise<FormattedBookResponse[]> {
  if (!catalogFlight) {
    const epoch = catalogEpoch
    catalogFlight = fetchCatalog()
      .then((books) => {
        if (epoch === catalogEpoch) {
          catalogCache = { at: Date.now(), books }
        }
        return catalogCache?.books ?? books
      })
      .finally(() => {
        catalogFlight = null
      })
  }
  return catalogFlight
}

async function readCatalog(): Promise<FormattedBookResponse[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_FRESH_MS) {
    return catalogCache.books
  }
  return refreshCatalog()
}

export async function listBooks(filters?: {
  status?: string
  borrowed?: string
}): Promise<FormattedBookResponse[]> {
  let borrowed: "Yes" | "No" | undefined
  if (filters?.status && !VALID_STATUSES.includes(filters.status as BookStatus)) {
    throw new HttpError(400, "Invalid status filter.")
  }
  if (filters?.borrowed) {
    borrowed =
      filters.borrowed === "Yes" || filters.borrowed === "true"
        ? "Yes"
        : filters.borrowed === "No" || filters.borrowed === "false"
          ? "No"
          : undefined
    if (!borrowed) {
      throw new HttpError(400, "Invalid borrowed filter. Use Yes or No.")
    }
  }

  const books = await readCatalog()
  return books.filter((book) => {
    if (filters?.status && book.Status !== filters.status) return false
    if (borrowed && (book.Borrowed ?? "No") !== borrowed) return false
    return true
  })
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

function applyCreateExtras(
  fields: FieldSet,
  extras?: BookCreatePayload
) {
  if (!extras) return
  if (extras.Author !== undefined) {
    if (typeof extras.Author !== "string") {
      throw new HttpError(400, "Author must be a string.")
    }
    const trimmedAuthor = extras.Author.trim()
    if (trimmedAuthor) fields.Author = trimmedAuthor
  }
  if (extras.Genre !== undefined) {
    if (typeof extras.Genre !== "string") {
      throw new HttpError(400, "Genre must be a string.")
    }
    const trimmedGenre = extras.Genre.trim()
    if (trimmedGenre) fields.Genre = trimmedGenre
  }
  if (extras.Status !== undefined) {
    if (!VALID_STATUSES.includes(extras.Status)) {
      throw new HttpError(400, "Invalid status.")
    }
    fields.Status = extras.Status
  }
  if (extras.Borrowed !== undefined) {
    if (extras.Borrowed !== "Yes" && extras.Borrowed !== "No") {
      throw new HttpError(400, "Borrowed must be Yes or No.")
    }
    fields.Borrowed = extras.Borrowed
  }
  setDateAliasedCreate(fields, START_DATE_FIELDS, extras.StartDate, "StartDate")
  setDateAliasedCreate(fields, END_DATE_FIELDS, extras.EndDate, "EndDate")
  if ((extras.Borrowed ?? fields.Borrowed) !== "No") {
    setAliasedIfFilled(
      fields,
      BORROWED_BY_FIELDS,
      extras.BorrowedBy,
      "BorrowedBy"
    )
    setDateAliasedCreate(
      fields,
      BORROWED_ON_FIELDS,
      extras.BorrowedOn,
      "BorrowedOn"
    )
    setDateAliasedCreate(
      fields,
      BORROWED_UNTIL_FIELDS,
      extras.BorrowedUntil,
      "BorrowedUntil"
    )
  }
}

function fieldsFromPreview(
  preview: FormattedBookResponse,
  isbn: string,
  extras?: BookCreatePayload
): FieldSet {
  const fields: FieldSet = {
    Title: preview.Title,
    Author: preview.Author,
    ISBN: isbn,
    Status: "TBR",
    Borrowed: "No",
  }

  if (preview.Genre?.trim()) fields.Genre = preview.Genre.trim()
  if (preview.coverUrl) {
    fields.Thumbnail = [
      { url: preview.coverUrl },
    ] as unknown as FieldSet["Thumbnail"]
  }

  applyCreateExtras(fields, extras)
  return fields
}

function fieldsFromManual(isbn: string, extras: BookCreatePayload): FieldSet {
  if (extras.Title !== undefined && typeof extras.Title !== "string") {
    throw new HttpError(400, "Title must be a string.")
  }
  const title = extras.Title?.trim()
  if (!title) {
    throw new HttpError(400, "Title is required.")
  }
  if (extras.Author !== undefined && typeof extras.Author !== "string") {
    throw new HttpError(400, "Author must be a string.")
  }

  const fields: FieldSet = {
    Title: title,
    Author: extras.Author?.trim() ?? "",
    ISBN: isbn,
    Status: "TBR",
    Borrowed: "No",
  }

  applyCreateExtras(fields, extras)
  return fields
}

async function executeCreateBook(
  cleanIsbn: string,
  extras?: BookCreatePayload
): Promise<FormattedBookResponse> {
  if (extras?.Title !== undefined && typeof extras.Title !== "string") {
    throw new HttpError(400, "Title must be a string.")
  }
  const manual = Boolean(extras?.Title?.trim())
  if (manual) {
    fieldsFromManual(cleanIsbn, extras ?? {})
  } else {
    applyCreateExtras({ Status: "TBR", Borrowed: "No" }, extras)
  }

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
    return restoreDeleted(cleanIsbn, deleted.id, manual, extras)
  }

  return insertBook(cleanIsbn, manual, extras)
}

export async function createBook(
  isbn: string,
  extras?: BookCreatePayload
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  if (!cleanIsbn) {
    throw new HttpError(400, "A valid ISBN is required.")
  }

  const previous = inFlightCreates.get(cleanIsbn) ?? Promise.resolve()
  const task = previous
    .catch(() => undefined)
    .then(() => executeCreateBook(cleanIsbn, extras))
  const settled = task.then(
    () => undefined,
    () => undefined
  )
  inFlightCreates.set(cleanIsbn, settled)
  try {
    return await task
  } finally {
    if (inFlightCreates.get(cleanIsbn) === settled) {
      inFlightCreates.delete(cleanIsbn)
    }
  }
}

async function restoreDeleted(
  isbn: string,
  recordId: string,
  manual: boolean,
  extras?: BookCreatePayload
) {
  let restoredFields: FieldSet
  if (manual) {
    restoredFields = { ...fieldsFromManual(isbn, extras ?? {}) }
  } else {
    restoredFields = {
      Status: "TBR",
      Borrowed: "No",
    }
    applyCreateExtras(restoredFields, extras)
  }
  setAliased(restoredFields, DELETED_AT_FIELDS, null)
  if ((extras?.Borrowed ?? "No") === "No") {
    clearBorrowedPerson(restoredFields)
  }
  try {
    const restored = await applyRecordFields(restoredFields, recordId)
    const book = formatRecord(restored, true)
    rememberBook(book)
    return book
  } catch (error) {
    if (
      error instanceof AirtableRequestError &&
      (error.status === 404 || error.status === 403)
    ) {
      return insertBook(isbn, manual, extras)
    }
    throw error
  }
}

async function insertBook(
  isbn: string,
  manual: boolean,
  extras?: BookCreatePayload
) {
  if (manual) {
    const created = await applyRecordFields(fieldsFromManual(isbn, extras ?? {}))
    const book = formatRecord(created, true)
    rememberBook(book)
    return book
  }

  const preview = await fetchBookFromCatalogs(isbn)
  const created = await applyRecordFields(
    fieldsFromPreview(preview, isbn, extras)
  )
  const book = formatRecord(created, true)
  rememberBook(book)
  return book
}

async function applyWithRecordFallback(
  isbn: string,
  fields: FieldSet,
  recordId?: string
): Promise<AirtableRecord> {
  const trimmedId = recordId?.trim()
  const hintId =
    (trimmedId && VALID_RECORD_ID.test(trimmedId) ? trimmedId : undefined) ||
    catalogCache?.books.find((book) => book.ISBN === isbn)?.id

  if (hintId) {
    try {
      return await applyRecordFields(fields, hintId)
    } catch (error) {
      if (
        !(error instanceof AirtableRequestError) ||
        (error.status !== 404 && error.status !== 403)
      ) {
        throw error
      }
      forgetBook(isbn, hintId)
    }
  }

  const active = await findActiveRecordByIsbn(isbn)
  if (!active) {
    throw new HttpError(404, `Book with ISBN ${isbn} is not in the library.`)
  }
  return applyRecordFields(fields, active.id)
}

export async function updateBook(
  isbn: string,
  patch: BookUpdatePayload,
  recordId?: string
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  const fields: FieldSet = {}

  if (patch.Title !== undefined) {
    if (typeof patch.Title !== "string") {
      throw new HttpError(400, "Title must be a string.")
    }
    const title = patch.Title.trim()
    if (!title) {
      throw new HttpError(400, "Title is required.")
    }
    fields.Title = title
  }

  if (patch.Author !== undefined) {
    if (typeof patch.Author !== "string") {
      throw new HttpError(400, "Author must be a string.")
    }
    fields.Author = patch.Author.trim()
  }

  if (patch.Genre !== undefined) {
    if (patch.Genre === null) {
      fields.Genre = null
    } else if (typeof patch.Genre === "string") {
      fields.Genre = patch.Genre.trim() || null
    } else {
      throw new HttpError(400, "Genre must be a string.")
    }
  }

  if (patch.Status !== undefined) {
    if (!VALID_STATUSES.includes(patch.Status)) {
      throw new HttpError(400, "Invalid status.")
    }
    fields.Status = patch.Status
  }

  setDateAliasedUpdate(fields, START_DATE_FIELDS, patch.StartDate, "StartDate")
  setDateAliasedUpdate(fields, END_DATE_FIELDS, patch.EndDate, "EndDate")

  if (patch.Borrowed !== undefined) {
    if (patch.Borrowed !== "Yes" && patch.Borrowed !== "No") {
      throw new HttpError(400, "Borrowed must be Yes or No.")
    }
    fields.Borrowed = patch.Borrowed
    if (patch.Borrowed === "No") {
      clearBorrowedPerson(fields)
    }
  }

  if (patch.Borrowed !== "No") {
    if (patch.BorrowedBy !== undefined) {
      if (patch.BorrowedBy === null) {
        setAliased(fields, BORROWED_BY_FIELDS, null)
      } else if (typeof patch.BorrowedBy === "string") {
        setAliased(fields, BORROWED_BY_FIELDS, patch.BorrowedBy.trim() || null)
      } else {
        throw new HttpError(400, "BorrowedBy must be a string.")
      }
    }
    setDateAliasedUpdate(
      fields,
      BORROWED_ON_FIELDS,
      patch.BorrowedOn,
      "BorrowedOn"
    )
    setDateAliasedUpdate(
      fields,
      BORROWED_UNTIL_FIELDS,
      patch.BorrowedUntil,
      "BorrowedUntil"
    )
  }

  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, "No valid fields to update.")
  }

  const updated = await applyWithRecordFallback(cleanIsbn, fields, recordId)
  if (isDeleted(firstNamedField(updated, DELETED_AT_FIELDS))) {
    forgetBook(cleanIsbn, updated.id)
    throw new HttpError(404, `Book with ISBN ${cleanIsbn} is not in the library.`)
  }
  const book = formatRecord(updated, true)
  rememberBook(book)
  return book
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
    const match = text.match(/Cannot parse date value "" for field "?([^"]+)"?$/)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function isThumbnailValueError(error: unknown): boolean {
  const type =
    error instanceof AirtableRequestError ? error.error?.type : undefined
  const texts = airtableErrorTexts(error)
  if (
    type !== "INVALID_VALUE_FOR_COLUMN" &&
    type !== "INVALID_ATTACHMENT_OBJECT" &&
    !texts.some((text) => /attachment/i.test(text))
  ) {
    return false
  }
  return texts.some((text) => /\bThumbnail\b/i.test(text))
}

function applyCachedFieldNames(fields: FieldSet): FieldSet {
  const resolved: FieldSet = {}
  for (const [key, value] of Object.entries(fields)) {
    const group = FIELD_TO_GROUP.get(key)
    if (!group) {
      resolved[key] = value
      continue
    }
    const cached = resolvedColumnName(group[0])
    if (cached === null) continue
    const target = cached ?? key
    if (!(target in resolved)) {
      resolved[target] = value
    }
  }
  return resolved
}

function cacheSuccessfulFieldNames(fields: FieldSet) {
  const now = Date.now()
  for (const key of Object.keys(fields)) {
    const group = FIELD_TO_GROUP.get(key)
    if (group) {
      resolvedFieldNames.set(group[0], { name: key, at: now })
    }
  }
}

async function applyRecordFields(fields: FieldSet, existingId?: string) {
  const pending = applyCachedFieldNames(fields)
  const tried = new Set<string>()
  const table = getAirtableBase()(TABLE_NAME)

  while (Object.keys(pending).length > 0) {
    try {
      const record = existingId
        ? await table.update(existingId, pending)
        : await table.create(pending)
      cacheSuccessfulFieldNames(pending)
      return record
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

      if ("Thumbnail" in pending && isThumbnailValueError(error)) {
        const current = pending.Thumbnail
        if (
          Array.isArray(current) &&
          current[0] &&
          typeof current[0] === "object" &&
          "url" in current[0] &&
          typeof (current[0] as { url?: unknown }).url === "string"
        ) {
          pending.Thumbnail = (current[0] as { url: string }).url
          continue
        }
        delete pending.Thumbnail
        continue
      }

      const name = unknownAirtableField(error)
      if (name && name in pending) {
        tried.add(name)
        const group = FIELD_TO_GROUP.get(name)
        if (group && resolvedFieldNames.get(group[0])?.name === name) {
          resolvedFieldNames.delete(group[0])
        }
        const alias = FIELD_ALIASES[name]
        if (alias && !tried.has(alias) && !(alias in pending)) {
          pending[alias] = pending[name]
        } else if (group) {
          resolvedFieldNames.set(group[0], { name: null, at: Date.now() })
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
  isbn: string,
  recordId?: string
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn)
  const fields: FieldSet = {}
  setAliased(fields, DELETED_AT_FIELDS, new Date().toISOString())
  const updated = await applyWithRecordFallback(cleanIsbn, fields, recordId)
  const book = formatRecord(updated, false)
  forgetBook(cleanIsbn, updated.id)
  return book
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

export function __resetBookServiceForTests() {
  catalogCache = null
  catalogFlight = null
  catalogEpoch = 0
  resolvedFieldNames.clear()
  inFlightCreates.clear()
  __resetAirtableForTests()
}
