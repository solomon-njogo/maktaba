import type { LocalBook } from "@/lib/offline/types"

export function isOnShelf(book: LocalBook) {
  return book.Status !== "To-Buy"
}

export type ShelfCounts = {
  shelf: number
  borrowed: number
  tbr: number
  toBuy: number
}

export function shelfCounts(books: LocalBook[]): ShelfCounts {
  const counts: ShelfCounts = { shelf: 0, borrowed: 0, tbr: 0, toBuy: 0 }

  for (const book of books) {
    if (isOnShelf(book)) counts.shelf += 1
    if (book.Borrowed === "Yes") counts.borrowed += 1
    if (book.Status === "TBR") counts.tbr += 1
    if (book.Status === "To-Buy") counts.toBuy += 1
  }

  return counts
}

function calendarDay(value?: string) {
  return value?.slice(0, 10) ?? ""
}

export function booksWaitingToStart(books: LocalBook[]) {
  return books
    .filter((book) => book.Status === "TBR" && book.Borrowed !== "Yes")
    .sort((a, b) => {
      const title = a.Title.localeCompare(b.Title, undefined, {
        sensitivity: "base",
      })
      if (title !== 0) return title
      return a.Author.localeCompare(b.Author, undefined, { sensitivity: "base" })
    })
}

export function pickReadingCard(books: LocalBook[]) {
  const reading = books.filter((book) => book.Status === "Reading")
  reading.sort((a, b) => {
    const aStart = calendarDay(a.StartDate)
    const bStart = calendarDay(b.StartDate)
    if (aStart !== bStart) {
      if (!aStart) return 1
      if (!bStart) return -1
      return bStart.localeCompare(aStart)
    }
    const byAdded = calendarDay(b.DateAdded).localeCompare(calendarDay(a.DateAdded))
    if (byAdded !== 0) return byAdded
    return a.Title.localeCompare(b.Title, undefined, { sensitivity: "base" })
  })
  return reading[0] ?? null
}
