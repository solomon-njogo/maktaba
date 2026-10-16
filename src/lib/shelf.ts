import type { LocalBook } from "@/lib/offline/types"
import type { BookStatus } from "@/types/books"

export type ShelfStatusFilter = "All" | Exclude<BookStatus, "To-Buy">

export const SHELF_STATUS_FILTERS: ShelfStatusFilter[] = [
  "All",
  "Reading",
  "Done",
  "TBR",
]

/** Matches `minmax(9rem, 1fr)` and `gap-3` on the shelf grid. */
const COVER_MIN_PX = 144
const GRID_GAP_PX = 12

export function isOnShelf(book: LocalBook) {
  return book.Status !== "To-Buy"
}

export function bookMatchesQuery(book: LocalBook, query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true

  const haystack = [
    book.Title,
    book.Author,
    book.ISBN,
    book.Genre,
    book.BorrowedBy,
    book.Status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return terms.every((term) => haystack.includes(term))
}

function compareCatalog(a: LocalBook, b: LocalBook) {
  const title = a.Title.localeCompare(b.Title, undefined, { sensitivity: "base" })
  if (title !== 0) return title
  const author = a.Author.localeCompare(b.Author, undefined, {
    sensitivity: "base",
  })
  if (author !== 0) return author
  return (b.DateAdded ?? "").localeCompare(a.DateAdded ?? "")
}

function compareAdded(a: LocalBook, b: LocalBook) {
  const aDate = a.DateAdded ?? ""
  const bDate = b.DateAdded ?? ""
  if (!aDate && bDate) return 1
  if (aDate && !bDate) return -1
  const byDate = bDate.localeCompare(aDate)
  if (byDate !== 0) return byDate
  return a.Title.localeCompare(b.Title, undefined, { sensitivity: "base" })
}

function continueRank(book: LocalBook) {
  return book.StartDate || book.DateAdded || ""
}

export function catalogOrder(books: LocalBook[]) {
  return [...books].sort(compareCatalog)
}

export function recentlyAdded(books: LocalBook[]) {
  return [...books].sort(compareAdded)
}

export function pickContinueReading(books: LocalBook[]) {
  const reading = books.filter((book) => book.Status === "Reading")
  reading.sort((a, b) => {
    const byRank = continueRank(b).localeCompare(continueRank(a))
    if (byRank !== 0) return byRank
    const byAdded = (b.DateAdded ?? "").localeCompare(a.DateAdded ?? "")
    if (byAdded !== 0) return byAdded
    return a.Title.localeCompare(b.Title, undefined, { sensitivity: "base" })
  })
  return reading[0] ?? null
}

export function columnsForWidth(width: number) {
  if (width <= 0) return 1
  return Math.max(1, Math.floor((width + GRID_GAP_PX) / (COVER_MIN_PX + GRID_GAP_PX)))
}
