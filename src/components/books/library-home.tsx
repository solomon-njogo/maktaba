"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { BookOpenIcon } from "lucide-react"
import { toast } from "sonner"

import { useLibrary } from "@/components/books/library-provider"
import { StatusBadge } from "@/components/books/status-badge"
import { PageShell } from "@/components/layout/page-shell"
import { AppLink } from "@/components/offline/app-link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { useMdUp } from "@/hooks/use-md-up"
import { ApiError } from "@/lib/api/books"
import { updateLocalBook } from "@/lib/offline/books-repository"
import type { LocalBook } from "@/lib/offline/types"
import {
  booksWaitingToStart,
  pickReadingCard,
  shelfCounts,
} from "@/lib/shelf"
import { cn } from "@/lib/utils"

const COUNTS = [
  { key: "shelf", label: "Shelf" },
  { key: "borrowed", label: "Borrowed" },
  { key: "tbr", label: "TBR" },
  { key: "toBuy", label: "To-Buy" },
] as const

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

function localToday() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
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
  const counts = useMemo(() => shelfCounts(books), [books])
  const reading = useMemo(() => pickReadingCard(books), [books])
  const waiting = useMemo(() => booksWaitingToStart(books), [books])

  return (
    <PageShell>
      <h1 className="sr-only">Home</h1>
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading library…
        </div>
      ) : (
        <>
          <section aria-label="Shelf summary">
            <dl className="grid grid-cols-2 overflow-hidden rounded-2xl bg-summary text-summary-foreground sm:grid-cols-4">
              {COUNTS.map((item, index) => (
                <div
                  key={item.key}
                  className={cn(
                    "min-w-0 px-3 py-2.5 sm:px-4",
                    index % 2 === 1 && "border-l border-white/15",
                    index >= 2 && "border-t border-white/15 sm:border-t-0",
                    index > 0 && "sm:border-l sm:border-white/15"
                  )}
                >
                  <dt className="text-xs text-summary-foreground/70">{item.label}</dt>
                  <dd className="text-sm tabular-nums sm:text-base">
                    {counts[item.key]}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-label="Reading" className="flex flex-col gap-3">
            {reading ? (
              <ReadingCard book={reading} />
            ) : (
              <StartReadingCard books={waiting} />
            )}
          </section>
        </>
      )}
    </PageShell>
  )
}

function ReadingCard({ book }: { book: LocalBook }) {
  const href = bookHref(book)
  const started = displayDate(book.StartDate)

  return (
    <article className="rounded-2xl bg-card/80 p-3 shadow-[0_12px_40px_-18px_oklch(0.35_0.03_70/0.45)] ring-1 ring-foreground/10 backdrop-blur-xl sm:p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <CoverFrame book={book} sizes="80px" className="w-16 shrink-0 sm:w-20" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <h2 className="font-heading text-base leading-snug sm:text-lg">{book.Title}</h2>
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

function StartReadingCard({ books }: { books: LocalBook[] }) {
  const mdUp = useMdUp()
  const [open, setOpen] = useState(false)
  const [pendingIsbn, setPendingIsbn] = useState<string | null>(null)

  async function startReading(book: LocalBook) {
    if (!book.ISBN || pendingIsbn) return
    setPendingIsbn(book.ISBN)
    try {
      await updateLocalBook(book.ISBN, {
        Status: "Reading",
        StartDate: localToday(),
      })
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not start reading.")
    } finally {
      setPendingIsbn(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="h-auto w-full justify-start rounded-2xl bg-card/80 px-3 py-4 text-left whitespace-normal shadow-[0_12px_40px_-18px_oklch(0.35_0.03_70/0.45)] ring-1 ring-foreground/10 backdrop-blur-xl hover:bg-card sm:px-4 md:h-auto"
          />
        }
      >
        <span className="font-heading text-base sm:text-lg">Start reading.</span>
      </SheetTrigger>
      <SheetContent
        side={mdUp ? "right" : "bottom"}
        className="w-full data-[side=bottom]:max-h-[90dvh] data-[side=right]:sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Start reading</SheetTitle>
          <SheetDescription>
            TBR books that are not Borrowed, in title order.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
          {books.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is waiting.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {books.map((book) => (
                <li key={bookKey(book)}>
                  <button
                    type="button"
                    disabled={!book.ISBN || pendingIsbn !== null}
                    onClick={() => void startReading(book)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <CoverFrame
                      book={book}
                      sizes="48px"
                      className="w-10 shrink-0 sm:w-12"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{book.Title}</span>
                      {book.Author ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {book.Author}
                        </span>
                      ) : null}
                    </span>
                    {pendingIsbn === book.ISBN ? <Spinner /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
