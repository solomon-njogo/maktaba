"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { BookCard } from "@/components/books/book-card"
import { useLibrary } from "@/components/books/library-provider"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, lookupBook } from "@/lib/api/books"
import { useMdUp } from "@/hooks/use-md-up"
import {
  debouncedIsbn10Candidate,
  immediateLookupIsbns,
  isLookupReadyIsbn,
  parseIsbnList,
} from "@/lib/isbn"
import { createLocalBook } from "@/lib/offline/books-repository"
import type { BookStatus, FormattedBookResponse } from "@/types/books"

const STATUSES: BookStatus[] = ["TBR", "Reading", "Done", "To-Buy"]
const LOOKUP_DEBOUNCE_MS = 400
const LOOKUP_CONCURRENCY = 4

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"

type LookupRow = {
  isbn: string
  status: "pending" | "found" | "inLibrary" | "error" | "added"
  book?: FormattedBookResponse
  error?: string
}

const OFFLINE_LOOKUP_ERROR =
  "Catalog lookup needs a network. Enter the title below, or save the ISBN to look up later."

export function AddBookSheet() {
  const mdUp = useMdUp()
  const { books } = useLibrary()
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState("")
  const [rows, setRows] = useState<Record<string, LookupRow>>({})
  const [manualOpen, setManualOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [genre, setGenre] = useState("")
  const [status, setStatus] = useState<BookStatus>("TBR")
  const [saving, setSaving] = useState(false)
  const [addingIsbn, setAddingIsbn] = useState<string | null>(null)

  const booksRef = useRef(books)
  booksRef.current = books
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const generationRef = useRef(0)
  const inflightRef = useRef(new Set<string>())
  const cacheRef = useRef(new Map<string, LookupRow>())
  const activeRef = useRef(0)
  const waitersRef = useRef<Array<() => void>>([])

  const displayIsbns = useMemo(
    () => parseIsbnList(raw).filter(isLookupReadyIsbn),
    [raw]
  )
  const isBulk = displayIsbns.length > 1
  const singleIsbn = displayIsbns.length === 1 ? displayIsbns[0] : undefined
  const singleRow = singleIsbn ? rows[singleIsbn] : undefined
  const alreadyInLibrary = Boolean(
    singleRow?.status === "inLibrary" || singleRow?.status === "added"
  )
  const addableIsbns = displayIsbns.filter(
    (isbn) => rows[isbn]?.status === "found"
  )
  const lookingUp =
    displayIsbns.some((isbn) => !rows[isbn] || rows[isbn].status === "pending") ||
    Boolean(debouncedIsbn10Candidate(raw) && !isBulk)

  function reset() {
    generationRef.current += 1
    inflightRef.current.clear()
    cacheRef.current.clear()
    setRaw("")
    setRows({})
    setManualOpen(false)
    setTitle("")
    setAuthor("")
    setGenre("")
    setStatus("TBR")
    setSaving(false)
    setAddingIsbn(null)
  }

  function acquireSlot() {
    return new Promise<void>((resolve) => {
      if (activeRef.current < LOOKUP_CONCURRENCY) {
        activeRef.current += 1
        resolve()
        return
      }
      waitersRef.current.push(() => {
        activeRef.current += 1
        resolve()
      })
    })
  }

  function releaseSlot() {
    activeRef.current = Math.max(0, activeRef.current - 1)
    const next = waitersRef.current.shift()
    if (next) next()
  }

  async function runLookup(isbn: string, gen: number) {
    if (gen !== generationRef.current) return

    const current = rowsRef.current[isbn]
    if (current && current.status !== "pending") {
      return
    }

    const cached = cacheRef.current.get(isbn)
    if (cached && cached.status !== "pending") {
      setRows((prev) => ({ ...prev, [isbn]: cached }))
      return
    }

    if (inflightRef.current.has(isbn)) return
    inflightRef.current.add(isbn)
    setRows((prev) => ({
      ...prev,
      [isbn]: prev[isbn]?.status === "added" ? prev[isbn] : { isbn, status: "pending" },
    }))

    await acquireSlot()
    try {
      if (gen !== generationRef.current) return

      const local = booksRef.current.find(
        (book) => book.ISBN === isbn && !book.deleted
      )
      if (local) {
        const row: LookupRow = {
          isbn,
          status: "inLibrary",
          book: { ...local, inLibrary: true },
        }
        cacheRef.current.set(isbn, row)
        setRows((prev) =>
          prev[isbn]?.status === "added" ? prev : { ...prev, [isbn]: row }
        )
        return
      }

      const online = typeof navigator === "undefined" ? true : navigator.onLine
      if (!online) {
        const row: LookupRow = {
          isbn,
          status: "error",
          error: OFFLINE_LOOKUP_ERROR,
        }
        cacheRef.current.set(isbn, row)
        setRows((prev) =>
          prev[isbn]?.status === "added" ? prev : { ...prev, [isbn]: row }
        )
        return
      }

      const book = await lookupBook(isbn)
      if (gen !== generationRef.current) return
      const row: LookupRow = book.inLibrary
        ? { isbn, status: "inLibrary", book }
        : { isbn, status: "found", book }
      cacheRef.current.set(isbn, row)
      setRows((prev) =>
        prev[isbn]?.status === "added" ? prev : { ...prev, [isbn]: row }
      )
    } catch (error) {
      if (gen !== generationRef.current) return
      const row: LookupRow = {
        isbn,
        status: "error",
        error: error instanceof ApiError ? error.message : "Lookup failed.",
      }
      cacheRef.current.set(isbn, row)
      setRows((prev) =>
        prev[isbn]?.status === "added" ? prev : { ...prev, [isbn]: row }
      )
    } finally {
      inflightRef.current.delete(isbn)
      releaseSlot()
    }
  }

  useEffect(() => {
    if (!open) return

    const gen = generationRef.current
    const immediate = immediateLookupIsbns(raw)
    const delayed = debouncedIsbn10Candidate(raw)
    const keep = new Set(parseIsbnList(raw).filter(isLookupReadyIsbn))

    setRows((prev) => {
      const next: Record<string, LookupRow> = {}
      let changed = Object.keys(prev).length !== keep.size
      for (const isbn of keep) {
        if (prev[isbn]) {
          next[isbn] = prev[isbn]
        } else {
          next[isbn] = { isbn, status: "pending" }
          changed = true
        }
      }
      for (const key of Object.keys(prev)) {
        if (!keep.has(key)) changed = true
      }
      return changed ? next : prev
    })

    for (const isbn of immediate) {
      void runLookup(isbn, gen)
    }

    if (!delayed) return
    const timer = window.setTimeout(() => {
      void runLookup(delayed, gen)
    }, LOOKUP_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // runLookup reads only refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, raw])

  useEffect(() => {
    if (!singleIsbn || isBulk) return
    if (singleRow?.status === "found" && singleRow.book) {
      setTitle(singleRow.book.Title)
      setAuthor(singleRow.book.Author)
      setGenre(singleRow.book.Genre ?? "")
      setStatus(singleRow.book.Status)
    }
    if (singleRow?.status === "error") {
      setManualOpen(true)
    }
  }, [singleIsbn, singleRow?.status, singleRow?.book, isBulk])

  useEffect(() => {
    if (isBulk) setManualOpen(false)
  }, [isBulk])

  async function handleSavePreview() {
    if (!singleRow?.book?.ISBN && !singleIsbn) return
    setSaving(true)
    try {
      const saved = await createLocalBook(singleRow?.book?.ISBN || singleIsbn!, {
        Title: singleRow?.book?.Title,
        Author: singleRow?.book?.Author,
        Genre: singleRow?.book?.Genre,
        Status: singleRow?.book?.Status,
      })
      toast.success(`Added ${saved.Title}`)
      setOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add book.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveIsbnOnly() {
    if (!singleIsbn) return
    setSaving(true)
    try {
      const saved = await createLocalBook(singleIsbn)
      toast.success(`Queued ${saved.ISBN}`)
      setOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add book.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveManual(event: React.FormEvent) {
    event.preventDefault()
    if (!singleIsbn || !title.trim()) return
    setSaving(true)
    try {
      const saved = await createLocalBook(singleIsbn, {
        Title: title.trim(),
        Author: author.trim(),
        Genre: genre.trim(),
        Status: status,
      })
      toast.success(`Added ${saved.Title}`)
      setOpen(false)
      reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add book.")
    } finally {
      setSaving(false)
    }
  }

  function markAdded(isbn: string, book?: FormattedBookResponse) {
    const row: LookupRow = { isbn, status: "added", book }
    cacheRef.current.set(isbn, row)
    setRows((prev) => ({ ...prev, [isbn]: row }))
  }

  async function handleAddOne(isbn: string) {
    const row = rowsRef.current[isbn]
    if (!row || row.status === "inLibrary" || row.status === "added") return
    setAddingIsbn(isbn)
    try {
      if (row.status === "found" && row.book) {
        const saved = await createLocalBook(row.book.ISBN || isbn, {
          Title: row.book.Title,
          Author: row.book.Author,
          Genre: row.book.Genre,
          Status: row.book.Status,
        })
        markAdded(isbn, row.book)
        toast.success(`Added ${saved.Title}`)
        return
      }
      if (row.status === "error") {
        const saved = await createLocalBook(isbn)
        markAdded(isbn)
        toast.success(`Queued ${saved.ISBN}`)
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add book.")
    } finally {
      setAddingIsbn(null)
    }
  }

  async function handleAddAll() {
    const targets = displayIsbns.filter(
      (isbn) => rowsRef.current[isbn]?.status === "found"
    )
    if (targets.length === 0) return
    setSaving(true)
    let added = 0
    let failed = 0
    const skipped = displayIsbns.filter(
      (isbn) =>
        rowsRef.current[isbn]?.status === "inLibrary" ||
        rowsRef.current[isbn]?.status === "added"
    ).length
    try {
      for (const isbn of targets) {
        const row = rowsRef.current[isbn]
        if (row?.status !== "found" || !row.book) continue
        try {
          await createLocalBook(row.book.ISBN || isbn, {
            Title: row.book.Title,
            Author: row.book.Author,
            Genre: row.book.Genre,
            Status: row.book.Status,
          })
          markAdded(isbn, row.book)
          added += 1
        } catch {
          failed += 1
        }
      }
      if (added > 0) {
        const bits = [`Added ${added} ${added === 1 ? "book" : "books"}`]
        if (skipped) bits.push(`${skipped} already in library`)
        if (failed) bits.push(`${failed} failed`)
        toast.success(bits.join(" · "))
        setOpen(false)
        reset()
      } else if (failed) {
        toast.error("Could not add books.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <SheetTrigger
        render={
          <Button
            size="sm"
            className="min-h-touch px-3 md:min-h-7 md:px-2.5"
          />
        }
      >
        Add book
      </SheetTrigger>
      <SheetContent
        side={mdUp ? "right" : "bottom"}
        className="w-full data-[side=bottom]:max-h-[90dvh] data-[side=right]:sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Add by ISBN</SheetTitle>
          <SheetDescription>
            Paste one ISBN or many (comma or newline). Titles look up
            automatically when online.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="isbn">ISBN</FieldLabel>
              <Textarea
                id="isbn"
                name="isbn"
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                placeholder={"9780143127741\n9780143127742"}
                autoComplete="off"
                rows={3}
              />
              {lookingUp && !isBulk ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Looking up…
                </p>
              ) : null}
            </Field>
          </FieldGroup>

          {isBulk ? (
            <ul className="flex flex-col gap-2">
              {displayIsbns.map((isbn) => (
                <LookupResultRow
                  key={isbn}
                  row={rows[isbn] ?? { isbn, status: "pending" }}
                  busy={addingIsbn === isbn || saving}
                  onAdd={() => void handleAddOne(isbn)}
                />
              ))}
            </ul>
          ) : (
            <>
              {singleRow?.status === "error" ? (
                <p className="text-sm text-destructive">{singleRow.error}</p>
              ) : null}
              {singleRow?.status === "pending" || (singleIsbn && !singleRow) ? (
                <BookCard loading />
              ) : null}
              {singleRow?.book &&
              (singleRow.status === "found" ||
                singleRow.status === "inLibrary" ||
                singleRow.status === "added") ? (
                <div className="flex flex-col gap-3">
                  {alreadyInLibrary ? (
                    <p className="text-sm text-muted-foreground">
                      This ISBN is already in the library.
                    </p>
                  ) : null}
                  <BookCard
                    book={{
                      Title: singleRow.book.Title,
                      Author: singleRow.book.Author,
                      Status: singleRow.book.Status,
                      Borrowed: singleRow.book.Borrowed,
                      BorrowedBy: singleRow.book.BorrowedBy,
                      coverUrl:
                        singleRow.book.coverUrl ?? singleRow.book.Thumbnail,
                    }}
                  />
                  {singleRow.book.Genre ? (
                    <p className="text-sm text-muted-foreground">
                      Genre: {singleRow.book.Genre}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {manualOpen ? (
                <form
                  id="manual-add-form"
                  onSubmit={handleSaveManual}
                  className="flex flex-col gap-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Manual entry — synced to Airtable when you are back online.
                  </p>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="manual-title">Title</FieldLabel>
                      <Input
                        id="manual-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="manual-author">Author</FieldLabel>
                      <Input
                        id="manual-author"
                        value={author}
                        onChange={(event) => setAuthor(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="manual-genre">Genre</FieldLabel>
                      <Input
                        id="manual-genre"
                        value={genre}
                        onChange={(event) => setGenre(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="manual-status">Status</FieldLabel>
                      <select
                        id="manual-status"
                        className={selectClassName}
                        value={status}
                        onChange={(event) =>
                          setStatus(event.target.value as BookStatus)
                        }
                      >
                        {STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </FieldGroup>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setManualOpen(true)}
                >
                  Enter details manually
                </Button>
              )}
            </>
          )}
        </div>
        <SheetFooter>
          {isBulk ? (
            <Button
              onClick={() => void handleAddAll()}
              disabled={saving || addableIsbns.length === 0}
            >
              {saving
                ? "Saving…"
                : addableIsbns.length > 0
                  ? `Add all (${addableIsbns.length})`
                  : "Add all"}
            </Button>
          ) : manualOpen ? (
            <Button
              type="submit"
              form="manual-add-form"
              disabled={!singleIsbn || !title.trim() || alreadyInLibrary || saving}
            >
              {saving ? "Saving…" : "Save to library"}
            </Button>
          ) : singleRow?.status === "found" && !alreadyInLibrary ? (
            <Button onClick={() => void handleSavePreview()} disabled={saving}>
              {saving ? "Saving…" : "Save to library"}
            </Button>
          ) : (
            <Button
              onClick={() => void handleSaveIsbnOnly()}
              disabled={!singleIsbn || alreadyInLibrary || saving}
              variant={singleRow?.book ? "default" : "outline"}
            >
              {saving ? "Saving…" : "Save ISBN for later lookup"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function LookupResultRow({
  row,
  busy,
  onAdd,
}: {
  row: LookupRow
  busy: boolean
  onAdd: () => void
}) {
  const cover = row.book?.coverUrl ?? row.book?.Thumbnail

  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 px-2.5 py-2">
      <div className="relative aspect-[2/3] w-10 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-foreground/10">
        {row.status === "pending" ? (
          <div className="flex size-full items-center justify-center">
            <Spinner className="size-3.5" />
          </div>
        ) : cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {row.book?.Title || row.isbn}
        </p>
        {row.status === "pending" ? (
          <p className="text-xs text-muted-foreground">Looking up…</p>
        ) : row.status === "inLibrary" || row.status === "added" ? (
          <p className="text-xs text-muted-foreground">
            {row.status === "added" ? "Added" : "Already in the library"}
          </p>
        ) : row.status === "error" ? (
          <p className="truncate text-xs text-destructive">
            {row.error ?? "Lookup failed."}
          </p>
        ) : (
          <p className="truncate text-xs text-muted-foreground">
            {row.book?.Author}
          </p>
        )}
      </div>
      {row.status === "found" ? (
        <Button size="sm" disabled={busy} onClick={onAdd}>
          {busy ? "Adding…" : "Add"}
        </Button>
      ) : row.status === "error" ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={onAdd}>
          {busy ? "Saving…" : "Save ISBN"}
        </Button>
      ) : null}
    </li>
  )
}
