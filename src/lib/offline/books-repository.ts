import type { BookUpdatePayload, FormattedBookResponse } from "@/types/books"
import { ApiError } from "@/lib/api/books"
import { cleanIsbnString } from "@/lib/isbn"

import {
  addOutboxOp,
  deleteBookRecord,
  getAllBooks,
  getBookByIsbn,
  pendingIsbnSet,
  putBook,
} from "./db"
import { notifyLibrary } from "./events"
import type { BookCreatePayload, LocalBook } from "./types"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function sortBooks(books: LocalBook[]): LocalBook[] {
  return [...books].sort((a, b) =>
    (b.DateAdded ?? "").localeCompare(a.DateAdded ?? "")
  )
}

export function filterBooks(
  books: LocalBook[],
  filters?: { status?: string; borrowed?: string }
): LocalBook[] {
  return sortBooks(
    books.filter((book) => {
      if (book.deleted) return false
      if (filters?.status && book.Status !== filters.status) return false
      if (filters?.borrowed && (book.Borrowed ?? "No") !== filters.borrowed) {
        return false
      }
      return true
    })
  )
}

export async function listLocalBooks(filters?: {
  status?: string
  borrowed?: string
}): Promise<LocalBook[]> {
  return filterBooks(await getAllBooks(), filters)
}

function applyPatch(book: LocalBook, patch: BookUpdatePayload): LocalBook {
  const next: LocalBook = { ...book, pending: true, inLibrary: true }

  if (patch.Title !== undefined) next.Title = patch.Title.trim()
  if (patch.Author !== undefined) next.Author = patch.Author.trim()
  if (patch.Genre !== undefined) next.Genre = patch.Genre.trim()
  if (patch.Status !== undefined) next.Status = patch.Status
  if (patch.StartDate !== undefined) next.StartDate = patch.StartDate
  if (patch.EndDate !== undefined) next.EndDate = patch.EndDate
  if (patch.Borrowed !== undefined) next.Borrowed = patch.Borrowed
  if (patch.BorrowedBy !== undefined) next.BorrowedBy = patch.BorrowedBy
  if (patch.BorrowedOn !== undefined) next.BorrowedOn = patch.BorrowedOn
  if (patch.BorrowedUntil !== undefined) next.BorrowedUntil = patch.BorrowedUntil

  if (patch.Borrowed === "No") {
    next.BorrowedBy = undefined
    next.BorrowedOn = undefined
    next.BorrowedUntil = undefined
  }

  return next
}

async function enqueue(
  type: "create" | "update" | "delete",
  isbn: string,
  payload?: BookCreatePayload
) {
  await addOutboxOp({
    id: crypto.randomUUID(),
    type,
    isbn,
    payload,
    createdAt: Date.now(),
  })
  notifyLibrary()
  void import("./sync").then((mod) => {
    void mod.drainOutbox()
    void mod.requestBackgroundSync()
  })
}

export async function createLocalBook(
  isbnInput: string,
  extras?: BookCreatePayload
): Promise<LocalBook> {
  const isbn = cleanIsbnString(isbnInput)
  if (!isbn) {
    throw new ApiError(400, "A valid ISBN is required.")
  }

  const existing = await getBookByIsbn(isbn)
  if (existing && !existing.deleted) {
    throw new ApiError(409, `Book with ISBN ${isbn} is already in the library.`)
  }

  const title = extras?.Title?.trim()
  const book: LocalBook = {
    ...(existing ?? {}),
    Title: title || existing?.Title || "Looking up…",
    Author: extras?.Author?.trim() ?? existing?.Author ?? "",
    ISBN: isbn,
    Status: extras?.Status ?? "TBR",
    StartDate: extras?.StartDate ?? existing?.StartDate,
    EndDate: extras?.EndDate ?? existing?.EndDate,
    Borrowed: extras?.Borrowed ?? "No",
    BorrowedBy: extras?.BorrowedBy,
    BorrowedOn: extras?.BorrowedOn,
    BorrowedUntil: extras?.BorrowedUntil,
    DateAdded: existing?.DateAdded ?? today(),
    Genre: extras?.Genre?.trim() || existing?.Genre,
    Thumbnail: existing?.Thumbnail,
    coverUrl: existing?.coverUrl ?? existing?.Thumbnail,
    inLibrary: true,
    pending: true,
    deleted: false,
  }

  await putBook(book)
  await enqueue("create", isbn, extras)
  return book
}

export async function updateLocalBook(
  isbnInput: string,
  patch: BookUpdatePayload
): Promise<LocalBook> {
  const isbn = cleanIsbnString(isbnInput)
  const existing = await getBookByIsbn(isbn)
  if (!existing || existing.deleted) {
    throw new ApiError(404, `Book with ISBN ${isbn} is not in the library.`)
  }
  if (patch.Title !== undefined && !patch.Title.trim()) {
    throw new ApiError(400, "Title is required.")
  }

  const next = applyPatch(existing, patch)
  await putBook(next)
  await enqueue("update", isbn, patch)
  return next
}

export async function removeLocalBook(isbnInput: string): Promise<LocalBook> {
  const isbn = cleanIsbnString(isbnInput)
  const existing = await getBookByIsbn(isbn)
  if (!existing || existing.deleted) {
    throw new ApiError(404, `Book with ISBN ${isbn} is not in the library.`)
  }

  const next: LocalBook = {
    ...existing,
    deleted: true,
    pending: true,
    inLibrary: false,
  }
  await putBook(next)
  await enqueue("delete", isbn)
  return next
}

export async function replaceRemoteCatalog(
  remote: FormattedBookResponse[]
): Promise<void> {
  const pending = await pendingIsbnSet()
  const local = await getAllBooks()
  const localByIsbn = new Map(
    local.filter((book) => book.ISBN).map((book) => [book.ISBN as string, book])
  )
  const remoteIsbns = new Set<string>()

  for (const book of remote) {
    const isbn = book.ISBN ? cleanIsbnString(book.ISBN) : ""
    if (!isbn) continue
    remoteIsbns.add(isbn)
    if (pending.has(isbn)) continue
    const previous = localByIsbn.get(isbn)
    await putBook({
      ...book,
      ISBN: isbn,
      pending: false,
      deleted: false,
      coverUrl: book.coverUrl ?? book.Thumbnail ?? previous?.coverUrl,
      Thumbnail: book.Thumbnail ?? previous?.Thumbnail,
    })
  }

  for (const book of local) {
    const isbn = book.ISBN
    if (!isbn || pending.has(isbn) || remoteIsbns.has(isbn)) continue
    if (book.deleted) continue
    await deleteBookRecord(isbn)
  }

  notifyLibrary()
}

export async function upsertRemoteBook(
  book: FormattedBookResponse,
  options?: { preserveLocal?: boolean }
): Promise<void> {
  const isbn = book.ISBN ? cleanIsbnString(book.ISBN) : ""
  if (!isbn) return
  const previous = await getBookByIsbn(isbn)
  if (options?.preserveLocal && previous) {
    await putBook({
      ...previous,
      id: book.id ?? previous.id,
      Thumbnail: book.Thumbnail ?? previous.Thumbnail,
      coverUrl: book.coverUrl ?? book.Thumbnail ?? previous.coverUrl,
      pending: true,
      deleted: false,
      inLibrary: true,
    })
    notifyLibrary()
    return
  }
  await putBook({
    ...previous,
    ...book,
    ISBN: isbn,
    pending: false,
    deleted: false,
    inLibrary: true,
  })
  notifyLibrary()
}
