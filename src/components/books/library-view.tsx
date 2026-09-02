import type { BookEmptyVariant } from "@/components/books/book-empty"
import { BookEmpty } from "@/components/books/book-empty"
import { LibraryBookCard } from "@/components/books/library-book-card"
import type { ListBooksFilters } from "@/lib/api/books"
import { listBooks } from "@/lib/server/book.service"

export async function LibraryView({
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
  let error: string | null = null
  let books: Awaited<ReturnType<typeof listBooks>> = []

  try {
    books = await listBooks(filters)
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Could not load books."
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
      </header>
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : books.length === 0 ? (
        <BookEmpty variant={emptyVariant} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {books.map((book) => (
            <li key={book.id ?? book.ISBN ?? book.Title}>
              <LibraryBookCard book={book} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
