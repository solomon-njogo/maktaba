"use client"

import { useMemo, useState } from "react"
import { SearchIcon, XIcon } from "lucide-react"

import type { BookEmptyVariant } from "@/components/books/book-empty"
import { BookEmpty } from "@/components/books/book-empty"
import { LibraryBookCard } from "@/components/books/library-book-card"
import { useLibrary } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type { ListBooksFilters } from "@/lib/api/books"
import type { LocalBook } from "@/lib/offline/types"

function bookMatchesQuery(book: LocalBook, query: string) {
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

function LibraryTotalCard({
  count,
  ready,
}: {
  count: number
  ready: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>Total books</CardDescription>
        {ready ? (
          <CardTitle className="text-3xl tabular-nums">
            {count.toLocaleString()}
          </CardTitle>
        ) : (
          <Skeleton className="h-9 w-16" />
        )}
      </CardHeader>
    </Card>
  )
}

export function LibraryView({
  title,
  description,
  filters,
  emptyVariant = "library",
  showTotal = false,
}: {
  title: string
  description: string
  filters?: ListBooksFilters
  emptyVariant?: BookEmptyVariant
  showTotal?: boolean
}) {
  const { books, ready } = useLibrary(filters)
  const [query, setQuery] = useState("")

  const visibleBooks = useMemo(
    () => books.filter((book) => bookMatchesQuery(book, query)),
    [books, query]
  )
  const searching = query.trim().length > 0

  return (
    <PageShell>
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
        {showTotal ? (
          <LibraryTotalCard count={books.length} ready={ready} />
        ) : null}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="library-search" className="sr-only">
              Search books
            </FieldLabel>
            <InputGroup className="h-touch md:h-8">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="library-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, author, ISBN…"
                autoComplete="off"
                enterKeyHint="search"
                className="h-full"
              />
              {searching ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <XIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </Field>
        </FieldGroup>
      </header>
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading library…
        </div>
      ) : books.length === 0 ? (
        <BookEmpty variant={emptyVariant} />
      ) : visibleBooks.length === 0 ? (
        <BookEmpty variant="search" />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visibleBooks.map((book) => (
            <li key={book.ISBN ?? book.id ?? book.Title}>
              <LibraryBookCard book={book} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
