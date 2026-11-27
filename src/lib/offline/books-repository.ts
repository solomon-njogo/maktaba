import type { BookUpdatePayload, FormattedBookResponse } from "@/types/books"
import { ApiError } from "@/lib/api/books"
import { cleanIsbnString } from "@/lib/isbn"

import {
  clearOutbox,
  commitBookAndOutbox,
  deleteBookRecord,
  getAllBooks,
  getBookByIsbn,
  getOutbox,
  putBook,
  removeOutboxOp,
  replaceOutboxOrder,
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
  if (patch.Genre !== undefined) next.Genre = patch.Genre.trim() || undefined
  if (patch.Status !== undefined) next.Status = patch.Status
  if (patch.StartDate !== undefined) next.StartDate = patch.StartDate || undefined
  if (patch.EndDate !== undefined) next.EndDate = patch.EndDate || undefined
  if (patch.Borrowed !== undefined) next.Borrowed = patch.Borrowed
  if (patch.BorrowedBy !== undefined) next.BorrowedBy = patch.BorrowedBy.trim() || undefined
  if (patch.BorrowedOn !== undefined) next.BorrowedOn = patch.BorrowedOn || undefined
  if (patch.BorrowedUntil !== undefined) next.BorrowedUntil = patch.BorrowedUntil || undefined

  if (patch.Borrowed === "No") {
    next.BorrowedBy = undefined
    next.BorrowedOn = undefined
    next.BorrowedUntil = undefined
  }

  return next
}

function mergePayloads(
  base: BookCreatePayload | undefined,
  patch: BookCreatePayload | undefined
): BookCreatePayload | undefined {
  if (!base && !patch) return undefined
  const merged: BookCreatePayload = { ...(base ?? {}), ...(patch ?? {}) }
  if (patch?.Borrowed === "No") {
    delete merged.BorrowedBy
    delete merged.BorrowedOn
    delete merged.BorrowedUntil
  }
  return merged
}

function buildUpsertedBook(
  previous: LocalBook | undefined,
  book: FormattedBookResponse,
  isbn: string,
  preserveLocal: boolean
): LocalBook {
  if (preserveLocal && previous) {
    const recoveredTitle =
      previous.Title === "Looking up…" &&
      Boolean(book.Title) &&
      book.Title !== "Looking up…"
    return {
      ...previous,
      id: book.id ?? previous.id,
      Title: recoveredTitle ? book.Title : previous.Title,
      Author:
        recoveredTitle && !previous.Author ? book.Author : previous.Author,
      Genre: recoveredTitle && !previous.Genre ? book.Genre : previous.Genre,
      Thumbnail: book.Thumbnail ?? previous.Thumbnail,
      coverUrl: book.coverUrl ?? book.Thumbnail ?? previous.coverUrl,
      pending: true,
      deleted: previous.deleted,
      inLibrary: previous.deleted ? false : true,
    }
  }
  return {
    ...previous,
    ...book,
    ISBN: isbn,
    pending: false,
    deleted: false,
    inLibrary: true,
  }
}

function triggerSync() {
  notifyLibrary()
  void import("./sync")
    .then((mod) => {
      void mod.drainOutbox()
      void mod.requestBackgroundSync()
    })
    .catch(() => {})
}

export async function createLocalBook(
  isbnInput: string,
  extras?: BookCreatePayload
): Promise<LocalBook> {
  const isbn = cleanIsbnString(isbnInput)
  if (!isbn) {
    throw new ApiError(400, "A valid ISBN is required.")
  }

  const title = extras?.Title?.trim()
  const book = await commitBookAndOutbox(async (tx) => {
    const existing = await tx.books.get(isbn)
    if (existing && !existing.deleted) {
      throw new ApiError(
        409,
        `Book with ISBN ${isbn} is already in the library.`
      )
    }

    const nextBook: LocalBook = {
      Title: title || existing?.Title || "Looking up…",
      Author: extras?.Author?.trim() ?? existing?.Author ?? "",
      ISBN: isbn,
      Status: extras?.Status ?? "TBR",
      StartDate: extras?.StartDate ?? existing?.StartDate,
      EndDate: extras?.EndDate ?? existing?.EndDate,
      Borrowed: extras?.Borrowed ?? "No",
      BorrowedBy:
        extras?.Borrowed === "Yes" ? extras?.BorrowedBy : undefined,
      BorrowedOn:
        extras?.Borrowed === "Yes" ? extras?.BorrowedOn : undefined,
      BorrowedUntil:
        extras?.Borrowed === "Yes" ? extras?.BorrowedUntil : undefined,
      DateAdded: existing?.DateAdded ?? today(),
      Genre: extras?.Genre?.trim() || existing?.Genre,
      Thumbnail: existing?.Thumbnail,
      coverUrl: existing?.coverUrl ?? existing?.Thumbnail,
      inLibrary: true,
      pending: true,
      deleted: false,
    }

    const allOps = await tx.outbox.getAll()
    const now = Date.now()
    await tx.books.put(nextBook)
    await tx.outbox.put({
      id: crypto.randomUUID(),
      type: "create",
      isbn,
      payload: extras,
      createdAt: tx.nextCreatedAt(allOps),
      queuedAt: now,
    })
    return nextBook
  })

  triggerSync()
  return book
}

export async function updateLocalBook(
  isbnInput: string,
  patch: BookUpdatePayload
): Promise<LocalBook> {
  const isbn = cleanIsbnString(isbnInput)
  if (patch.Title !== undefined && !patch.Title.trim()) {
    throw new ApiError(400, "Title is required.")
  }

  const nextBook = await commitBookAndOutbox(async (tx) => {
    const existing = await tx.books.get(isbn)
    if (!existing || existing.deleted) {
      throw new ApiError(404, `Book with ISBN ${isbn} is not in the library.`)
    }

    const next = applyPatch(existing, patch)
    const allOps = await tx.outbox.getAll()
    const sameIsbn = allOps.filter((op) => op.isbn === isbn)
    const last = sameIsbn[sameIsbn.length - 1]
    const now = Date.now()

    await tx.books.put(next)
    if (last && (last.type === "create" || last.type === "update")) {
      await tx.outbox.delete(last.id)
      await tx.outbox.put({
        id: crypto.randomUUID(),
        type: last.type,
        isbn,
        payload: mergePayloads(last.payload, patch),
        createdAt: last.createdAt,
        queuedAt: now,
      })
    } else {
      await tx.outbox.put({
        id: crypto.randomUUID(),
        type: "update",
        isbn,
        payload: patch,
        createdAt: tx.nextCreatedAt(allOps),
        queuedAt: now,
      })
    }
    return next
  })

  triggerSync()
  return nextBook
}

export async function removeLocalBook(isbnInput: string): Promise<LocalBook> {
  const isbn = cleanIsbnString(isbnInput)

  const { nextBook, needsSync } = await commitBookAndOutbox(async (tx) => {
    const existing = await tx.books.get(isbn)
    if (!existing || existing.deleted) {
      throw new ApiError(404, `Book with ISBN ${isbn} is not in the library.`)
    }

    const next: LocalBook = {
      ...existing,
      deleted: true,
      pending: true,
      inLibrary: false,
    }

    const allOps = await tx.outbox.getAll()
    const sameIsbn = allOps.filter((op) => op.isbn === isbn)
    const unattemptedCreateOnly =
      sameIsbn.length === 1 &&
      sameIsbn[0].type === "create" &&
      !existing.id &&
      !sameIsbn[0].lastAttemptAt &&
      !sameIsbn[0].attempts

    if (unattemptedCreateOnly) {
      await tx.outbox.delete(sameIsbn[0].id)
      await tx.books.delete(isbn)
      return { nextBook: next, needsSync: false }
    }

    const now = Date.now()
    for (const op of sameIsbn) {
      await tx.outbox.delete(op.id)
    }
    await tx.books.put(next)
    await tx.outbox.put({
      id: crypto.randomUUID(),
      type: "delete",
      isbn,
      createdAt: tx.nextCreatedAt(allOps),
      queuedAt: now,
    })
    return { nextBook: next, needsSync: true }
  })

  if (needsSync) {
    triggerSync()
  } else {
    notifyLibrary()
  }
  return nextBook
}

export async function replaceRemoteCatalog(
  remote: FormattedBookResponse[],
  alsoPending?: Iterable<string>
): Promise<void> {
  await commitBookAndOutbox(async (tx) => {
    const allOps = await tx.outbox.getAll()
    const pending = new Set(allOps.map((op) => op.isbn))
    if (alsoPending) {
      for (const isbn of alsoPending) pending.add(isbn)
    }
    const local = await tx.books.getAll()
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
      await tx.books.put({
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
      await tx.books.delete(isbn)
    }
  })
  notifyLibrary()
}

export async function upsertRemoteBook(
  book: FormattedBookResponse,
  options?: { preserveLocal?: boolean }
): Promise<void> {
  const isbn = book.ISBN ? cleanIsbnString(book.ISBN) : ""
  if (!isbn) return
  const previous = await getBookByIsbn(isbn)
  await putBook(
    buildUpsertedBook(previous, book, isbn, Boolean(options?.preserveLocal))
  )
  notifyLibrary()
}

export async function commitSyncedBookOp(
  opId: string,
  opIsbn: string,
  book: FormattedBookResponse
): Promise<"done" | "skipped"> {
  const result = await commitBookAndOutbox(async (tx) => {
    const allOps = await tx.outbox.getAll()
    const stillPending = allOps.some((op) => op.id === opId)
    const otherOps = allOps.some(
      (op) => op.isbn === opIsbn && op.id !== opId
    )
    const isbn = book.ISBN ? cleanIsbnString(book.ISBN) : opIsbn
    if (isbn) {
      const previous = await tx.books.get(isbn)
      await tx.books.put(buildUpsertedBook(previous, book, isbn, otherOps))
    }
    if (!stillPending) return "skipped"
    await tx.outbox.delete(opId)
    return "done"
  })
  notifyLibrary()
  return result
}

export async function commitSyncedDeleteOp(
  opId: string,
  isbn: string
): Promise<"done" | "skipped"> {
  const result = await commitBookAndOutbox(async (tx) => {
    const allOps = await tx.outbox.getAll()
    const stillPending = allOps.some((op) => op.id === opId)
    const otherOps = allOps.some((op) => op.isbn === isbn && op.id !== opId)
    if (!otherOps) {
      await tx.books.delete(isbn)
    }
    if (!stillPending) return "skipped"
    await tx.outbox.delete(opId)
    return "done"
  })
  notifyLibrary()
  return result
}

export async function dropAndReconcileOp(
  opId: string,
  isbn: string
): Promise<void> {
  await commitBookAndOutbox(async (tx) => {
    await tx.outbox.delete(opId)
    const remaining = (await tx.outbox.getAll()).filter(
      (op) => op.isbn === isbn
    )
    const book = await tx.books.get(isbn)
    if (remaining.length > 0) {
      if (!book?.id && !remaining.some((op) => op.type === "create")) {
        for (const op of remaining) {
          await tx.outbox.delete(op.id)
        }
        if (book) await tx.books.delete(isbn)
        return
      }
      if (book) {
        const willDelete = remaining[remaining.length - 1]?.type === "delete"
        await tx.books.put({
          ...book,
          pending: true,
          deleted: willDelete,
          inLibrary: !willDelete,
        })
      }
      return
    }
    if (!book) return
    if (!book.id) {
      await tx.books.delete(isbn)
      return
    }
    await tx.books.put({
      ...book,
      pending: false,
      deleted: false,
      inLibrary: true,
    })
  })
  notifyLibrary()
}

function refreshRemote(clearError: boolean) {
  void import("./sync")
    .then((mod) => {
      if (clearError) mod.clearSyncError()
      void mod.pullRemoteCatalog()
    })
    .catch(() => {})
}

export async function reconcileIsbn(isbn: string) {
  const remaining = (await getOutbox()).filter((op) => op.isbn === isbn)
  const book = await getBookByIsbn(isbn)

  if (remaining.length > 0) {
    if (!book?.id && !remaining.some((op) => op.type === "create")) {
      for (const op of remaining) {
        await removeOutboxOp(op.id)
      }
      if (book) await deleteBookRecord(isbn)
      return
    }

    if (book) {
      const willDelete = remaining[remaining.length - 1]?.type === "delete"
      await putBook({
        ...book,
        pending: true,
        deleted: willDelete,
        inLibrary: !willDelete,
      })
    }
    return
  }

  if (!book) return

  if (!book.id) {
    await deleteBookRecord(isbn)
    return
  }

  await putBook({
    ...book,
    pending: false,
    deleted: false,
    inLibrary: true,
  })
}

export async function dropQueuedOp(id: string) {
  const ops = await getOutbox()
  const op = ops.find((item) => item.id === id)
  if (!op) return
  await dropAndReconcileOp(id, op.isbn)
  const remaining = await getOutbox()
  refreshRemote(remaining.length === 0)
}

export async function clearQueuedOps() {
  const ops = await getOutbox()
  if (ops.length === 0) return
  const isbns = [...new Set(ops.map((op) => op.isbn))]
  await clearOutbox()
  for (const isbn of isbns) {
    await reconcileIsbn(isbn)
  }
  notifyLibrary()
  refreshRemote(true)
}

export async function moveQueuedOp(id: string, direction: -1 | 1) {
  const ops = await getOutbox()
  const index = ops.findIndex((op) => op.id === id)
  if (index < 0) return
  const targetIsbn = ops[index].isbn
  let next = index + direction
  while (next >= 0 && next < ops.length && ops[next].isbn === targetIsbn) {
    next += direction
  }
  if (next < 0 || next >= ops.length) return
  const ids = ops.map((op) => op.id)
  const [moved] = ids.splice(index, 1)
  ids.splice(next, 0, moved)
  await replaceOutboxOrder(ids)
  notifyLibrary()
}
