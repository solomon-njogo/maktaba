"use client"

import type { BookEmptyVariant } from "@/components/books/book-empty"
import { BookEmpty } from "@/components/books/book-empty"
import { LibraryBookCard } from "@/components/books/library-book-card"
import { useLibrary } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import { Spinner } from "@/components/ui/spinner"
import type { ListBooksFilters } from "@/lib/api/books"

export function LibraryView({
  title,
  description,
  filters,
  emptyVariant = "library",
}: {
  title: string
  description: string
  filters?: ListBooksFilters
  emptyVariant?: BookEmptyVariant
}) {
  const { books, ready } = useLibrary(filters)

  return (
    <PageShell>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
      </header>
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading library…
        </div>
      ) : books.length === 0 ? (
        <BookEmpty variant={emptyVariant} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {books.map((book) => (
            <li key={book.ISBN ?? book.id ?? book.Title}>
              <LibraryBookCard book={book} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
