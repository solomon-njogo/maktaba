"use client"

import { useMemo, useState } from "react"
import { SearchIcon, XIcon } from "lucide-react"

import type { BookEmptyVariant } from "@/components/books/book-empty"
import { BookEmpty } from "@/components/books/book-empty"
import { LibraryBookCard } from "@/components/books/library-book-card"
import { LibraryShelfFilters } from "@/components/books/library-shelf-filters"
import { useLibrary } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import { useAppPath } from "@/components/offline/app-path"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import type { ListBooksFilters } from "@/lib/api/books"

function bookMatchesQuery(
  book: {
    Title: string
    Author: string
    ISBN?: string
    Genre?: string
    BorrowedBy?: string
    Status: string
  },
  query: string
) {
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
  /** @deprecated Count is shown in the subtitle. */
  showTotal?: boolean
}) {
  const pathname = useAppPath() ?? "/library"
  const { books, ready } = useLibrary(filters)
  const [query, setQuery] = useState("")

  const visibleBooks = useMemo(
    () => books.filter((book) => bookMatchesQuery(book, query)),
    [books, query]
  )
  const searching = query.trim().length > 0
  const countLabel = ready
    ? `${books.length.toLocaleString()} ${books.length === 1 ? "book" : "books"}`
    : null

  return (
    <PageShell>
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {countLabel ? (
              <>
                <span className="tabular-nums text-foreground">{countLabel}</span>
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            {description}
          </p>
        </div>
        <LibraryShelfFilters pathname={pathname} />
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
                autoCorrect="off"
                spellCheck={false}
                className="h-full text-base md:text-sm"
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
        <BookEmpty
          variant="search"
          action={{
            kind: "button",
            label: "Clear search",
            onClick: () => setQuery(""),
          }}
        />
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
