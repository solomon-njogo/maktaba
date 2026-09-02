import type { FormattedBookResponse } from "@/types/books"

function coverUrls(books: FormattedBookResponse[]) {
  const urls = new Set<string>()
  for (const book of books) {
    if (book.coverUrl) urls.add(book.coverUrl)
    if (book.Thumbnail) urls.add(book.Thumbnail)
  }
  return [...urls]
}

export function warmCoverCache(books: FormattedBookResponse[]) {
  if (typeof window === "undefined" || typeof Image === "undefined") return
  const urls = coverUrls(books)
  for (const url of urls) {
    const image = new Image()
    image.referrerPolicy = "no-referrer"
    image.src = url
  }
}
