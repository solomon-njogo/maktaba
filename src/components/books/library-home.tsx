"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { BookOpenIcon, FilterIcon, SearchIcon, XIcon } from "lucide-react"

import { BookEmpty } from "@/components/books/book-empty"
import { useLibrary } from "@/components/books/library-provider"
import { StatusBadge } from "@/components/books/status-badge"
import { PageShell } from "@/components/layout/page-shell"
import { AppLink } from "@/components/offline/app-link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Button, buttonVariants } from "@/components/ui/button"
import type { LocalBook } from "@/lib/offline/types"
import {
  bookMatchesQuery,
  catalogOrder,
  columnsForWidth,
  isOnShelf,
  pickContinueReading,
  recentlyAdded,
  SHELF_STATUS_FILTERS,
  type ShelfStatusFilter,
} from "@/lib/shelf"
import { cn } from "@/lib/utils"

function bookKey(book: LocalBook) {
  return book.ISBN ?? book.id ?? `${book.Title}-${book.Author}`
}

function bookHref(book: LocalBook) {
  if (!book.ISBN) return null
  return `/books/${encodeURIComponent(book.ISBN)}`
}

function coverUrl(book: LocalBook) {
  return book.coverUrl ?? book.Thumbnail
}

function displayDate(value?: string) {
  const iso = value?.slice(0, 10) ?? ""
  if (!iso) return ""
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function CoverArt({
  book,
  sizes,
}: {
  book: LocalBook
  sizes: string
}) {
  const src = coverUrl(book)
  if (!src) {
    return (
      <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
        <BookOpenIcon />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      className="object-cover"
      unoptimized
    />
  )
}

function CoverFrame({
  book,
  sizes,
  className,
}: {
  book: LocalBook
  sizes: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-foreground/10",
        className
      )}
    >
      <CoverArt book={book} sizes={sizes} />
    </div>
  )
}

export function LibraryHome() {
  const { books, ready } = useLibrary()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<ShelfStatusFilter>("All")
  const [columns, setColumns] = useState<number | null>(null)
  const shelfRef = useRef<HTMLElement>(null)
  const searching = query.trim().length > 0

  const shelf = useMemo(() => books.filter(isOnShelf), [books])
  const continueBook = useMemo(() => pickContinueReading(shelf), [shelf])
  const added = useMemo(() => recentlyAdded(shelf), [shelf])
  const grid = useMemo(() => {
    const matched = shelf.filter((book) => {
      if (status !== "All" && book.Status !== status) return false
      return bookMatchesQuery(book, query)
    })
    return catalogOrder(matched)
  }, [query, shelf, status])

  const readingCount = shelf.filter((book) => book.Status === "Reading").length
  const borrowedCount = shelf.filter((book) => book.Borrowed === "Yes").length

  useEffect(() => {
    const node = shelfRef.current
    if (!node) return
    const measure = () => setColumns(columnsForWidth(node.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [ready, shelf.length])

  function showEntireShelf() {
    setQuery("")
    setStatus("All")
    shelfRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <PageShell>
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">Library</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Every book on the shelf.
          </p>
        </div>
        {ready && shelf.length > 0 ? (
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="library-search" className="sr-only">
                Search books
              </FieldLabel>
              <div className="flex items-center gap-2">
                <InputGroup className="h-touch rounded-full bg-card/80 backdrop-blur-md md:h-8">
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
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        aria-label={
                          status === "All"
                            ? "Filter by status"
                            : `Filtered by ${status}. Change status filter`
                        }
                        className={cn(
                          "size-touch shrink-0 rounded-full bg-card/80 px-0 backdrop-blur-md md:size-8",
                          status !== "All" && "w-auto gap-1.5 px-3"
                        )}
                      />
                    }
                  >
                    <FilterIcon />
                    {status !== "All" ? (
                      <span className="text-xs md:text-sm">{status}</span>
                    ) : null}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      {SHELF_STATUS_FILTERS.map((option) => (
                        <DropdownMenuItem
                          key={option}
                          onClick={() => setStatus(option)}
                        >
                          {option}
                          {status === option ? (
                            <span className="ml-auto text-xs text-muted-foreground">
                              Selected
                            </span>
                          ) : null}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Field>
          </FieldGroup>
        ) : null}
      </header>

      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading library…
        </div>
      ) : shelf.length === 0 ? (
        <BookEmpty variant="library" />
      ) : (
        <>
          <section aria-label="Shelf summary">
            <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-summary px-3 py-2.5 text-summary-foreground sm:px-4">
              <div className="min-w-0">
                <dt className="text-xs text-summary-foreground/70">Shelf</dt>
                <dd className="text-sm tabular-nums sm:text-base">{shelf.length}</dd>
              </div>
              <div className="min-w-0 border-l border-white/15 pl-3">
                <dt className="text-xs text-summary-foreground/70">Reading</dt>
                <dd className="text-sm tabular-nums sm:text-base">{readingCount}</dd>
              </div>
              <div className="min-w-0 border-l border-white/15 pl-3">
                <dt className="text-xs text-summary-foreground/70">Borrowed</dt>
                <dd className="text-sm tabular-nums sm:text-base">{borrowedCount}</dd>
              </div>
            </dl>
          </section>

          {continueBook ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-base">Continue Reading</h2>
              <ContinueCard book={continueBook} />
            </section>
          ) : null}

          <section
            ref={shelfRef}
            id="shelf"
            className="flex scroll-mt-24 flex-col gap-3 md:scroll-mt-36"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base">Shelf</h2>
              {columns != null ? (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {columns} {columns === 1 ? "column" : "columns"}
                </p>
              ) : null}
            </div>
            {grid.length === 0 ? (
              <BookEmpty variant="search" />
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
                {grid.map((book) => (
                  <li key={bookKey(book)}>
                    <ShelfTile book={book} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base">Recently Added</h2>
              <Button
                type="button"
                variant="ghost"
                className="h-touch px-3 md:h-8"
                onClick={showEntireShelf}
              >
                All
              </Button>
            </div>
            <ul className="-mx-page-x flex gap-3 overflow-x-auto px-page-x pb-1 snap-x snap-mandatory">
              {added.map((book) => (
                <li key={bookKey(book)} className="w-24 shrink-0 snap-start sm:w-28">
                  <RecentCover book={book} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </PageShell>
  )
}

function ContinueCard({ book }: { book: LocalBook }) {
  const href = bookHref(book)
  const started = displayDate(book.StartDate)
  const cover = (
    <CoverFrame
      book={book}
      sizes="80px"
      className="w-16 sm:w-20"
    />
  )

  return (
    <article className="rounded-2xl bg-card/80 p-3 shadow-[0_12px_40px_-18px_oklch(0.35_0.03_70/0.45)] ring-1 ring-foreground/10 backdrop-blur-xl sm:p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        {href ? (
          <AppLink href={href} aria-label={book.Title} className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {cover}
          </AppLink>
        ) : (
          cover
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <h3 className="font-heading text-base leading-snug sm:text-lg">
            {book.Title}
          </h3>
          {book.Author ? (
            <p className="text-sm text-muted-foreground">{book.Author}</p>
          ) : null}
          <StatusBadge status={book.Status} borrowed={book.Borrowed} />
          {started ? (
            <p className="text-xs text-muted-foreground">Started {started}</p>
          ) : null}
          {href ? (
            <AppLink
              href={href}
              className={cn(
                buttonVariants({ size: "sm" }),
                "mt-1 h-touch rounded-full bg-white px-4 text-foreground shadow-sm ring-1 ring-foreground/10 hover:bg-white/90 md:h-8"
              )}
            >
              Open
            </AppLink>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function ShelfTile({ book }: { book: LocalBook }) {
  const href = bookHref(book)
  const body = (
    <>
      <CoverFrame
        book={book}
        sizes="(max-width: 768px) 46vw, 180px"
      />
      <p className="line-clamp-2 text-sm font-medium leading-snug">{book.Title}</p>
      {book.Author ? (
        <p className="line-clamp-1 text-xs text-muted-foreground">{book.Author}</p>
      ) : null}
      <StatusBadge status={book.Status} borrowed={book.Borrowed} />
    </>
  )
  const className =
    "flex flex-col gap-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"

  if (!href) {
    return <div className={className}>{body}</div>
  }

  return (
    <AppLink href={href} className={className}>
      {body}
    </AppLink>
  )
}

function RecentCover({ book }: { book: LocalBook }) {
  const href = bookHref(book)
  const frame = (
    <CoverFrame book={book} sizes="112px" className="w-full" />
  )

  if (!href) {
    return <div aria-label={book.Title}>{frame}</div>
  }

  return (
    <AppLink
      href={href}
      aria-label={book.Title}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      {frame}
    </AppLink>
  )
}
