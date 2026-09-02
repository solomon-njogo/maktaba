import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BookDetail } from "@/components/books/book-detail"
import { ApiError, getBook } from "@/lib/api/books"

type BookPageProps = {
  params: Promise<{ isbn: string }>
}

export async function generateMetadata({
  params,
}: BookPageProps): Promise<Metadata> {
  const { isbn } = await params
  try {
    const book = await getBook(isbn)
    return { title: `${book.Title} · Maktaba` }
  } catch {
    return { title: "Book · Maktaba" }
  }
}

export default async function BookPage({ params }: BookPageProps) {
  const { isbn } = await params

  try {
    const book = await getBook(isbn)
    return <BookDetail book={book} />
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound()
    }
    const message =
      error instanceof Error ? error.message : "Could not load this book."
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl">Could not open this book</h1>
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      </div>
    )
  }
}
