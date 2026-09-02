"use client"

import { useParams } from "next/navigation"

import { BookDetail } from "@/components/books/book-detail"
import BookNotFound from "@/app/books/[isbn]/not-found"
import { useBook } from "@/components/books/library-provider"
import { Spinner } from "@/components/ui/spinner"
import { cleanIsbnString } from "@/lib/isbn"

export function BookPageClient() {
  const params = useParams<{ isbn: string }>()
  const isbn = cleanIsbnString(String(params.isbn ?? ""))
  const { book, ready, missing } = useBook(isbn || undefined)

  if (!ready) {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <Spinner />
        Opening book…
      </div>
    )
  }

  if (missing || !book) {
    return <BookNotFound />
  }

  return <BookDetail book={book} />
}
