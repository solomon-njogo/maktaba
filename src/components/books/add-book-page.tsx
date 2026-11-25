"use client"

import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ScanBarcode } from "lucide-react"

import { BookCard } from "@/components/books/book-card"
import {
  IsbnBarcodeScanner,
  useCameraAvailable,
} from "@/components/books/isbn-barcode-scanner"
import { useLibrary } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, lookupBook } from "@/lib/api/books"
import {
  appendIsbnToInput,
  debouncedIsbn10Candidate,
  immediateLookupIsbns,
  isLookupReadyIsbn,
  parseIsbnList,
} from "@/lib/isbn"
import { createLocalBook } from "@/lib/offline/books-repository"
import { navigateApp } from "@/lib/offline/navigation"
import type { BookStatus, FormattedBookResponse } from "@/types/books"
import { cn } from "@/lib/utils"

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

type AddedResult = {
  isbn: string
  title: string
}

const OFFLINE_LOOKUP_ERROR =
  "Catalog lookup needs a network. Enter the title below, or save the ISBN to look up later."

export function AddBookPage() {
  const { books } = useLibrary()
  const [raw, setRaw] = useState("")
  const [bulkMode, setBulkMode] = useState(false)
  const [rows, setRows] = useState<Record<string, LookupRow>>({})
  const [manualOpen, setManualOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [genre, setGenre] = useState("")
  const [status, setStatus] = useState<BookStatus>("TBR")
  const [saving, setSaving] = useState(false)
  const [addingIsbn, setAddingIsbn] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [added, setAdded] = useState<AddedResult | null>(null)
  const canScan = useCameraAvailable()

  const booksRef = useRef(books)
  booksRef.current = books
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const generationRef = useRef(0)
  const inflightRef = useRef(new Set<string>())
  const cacheRef = useRef(new Map<string, LookupRow>())
  const activeRef = useRef(0)
  const waitersRef = useRef<Array<() => void>>([])

  const displayIsbns = useMemo(() => {
    const all = parseIsbnList(raw).filter(isLookupReadyIsbn)
    if (bulkMode) return all
    return all.slice(0, 1)
  }, [raw, bulkMode])

  const isBulk = bulkMode && displayIsbns.length > 1
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

  function resetForm() {
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
    setScanning(false)
  }

  function startAnother() {
    setAdded(null)
    setBulkMode(false)
    resetForm()
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
    if (added) return
    const gen = generationRef.current
    const source = bulkMode ? raw : (parseIsbnList(raw)[0] ?? raw)
    const immediate = immediateLookupIsbns(source).slice(0, bulkMode ? undefined : 1)
    const delayed = bulkMode ? debouncedIsbn10Candidate(raw) : debouncedIsbn10Candidate(source)
    const keep = new Set(
      (bulkMode
        ? parseIsbnList(raw)
        : parseIsbnList(raw).slice(0, 1)
      ).filter(isLookupReadyIsbn)
    )

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

    if (!delayed || (!bulkMode && keep.size > 0)) return
    const timer = window.setTimeout(() => {
      void runLookup(delayed, gen)
    }, LOOKUP_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
    // runLookup reads only refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, bulkMode, added])

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

  function finishAdded(isbn: string, bookTitle: string) {
    setAdded({ isbn, title: bookTitle })
    resetForm()
  }

  async function handleSavePreview() {
    if (!singleRow?.book?.ISBN && !singleIsbn) return
    setSaving(true)
    try {
      const isbn = singleRow?.book?.ISBN || singleIsbn!
      const saved = await createLocalBook(isbn, {
        Title: singleRow?.book?.Title,
        Author: singleRow?.book?.Author,
        Genre: singleRow?.book?.Genre,
        Status: singleRow?.book?.Status,
      })
      toast.success(`Added ${saved.Title}`)
      finishAdded(saved.ISBN || isbn, saved.Title)
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
      finishAdded(saved.ISBN || singleIsbn, saved.Title || saved.ISBN || singleIsbn)
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
      finishAdded(saved.ISBN || singleIsbn, saved.Title)
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
    let addedCount = 0
    let failed = 0
    const skipped = displayIsbns.filter(
      (isbn) =>
        rowsRef.current[isbn]?.status === "inLibrary" ||
        rowsRef.current[isbn]?.status === "added"
    ).length
    let lastIsbn = ""
    let lastTitle = ""
    try {
      for (const isbn of targets) {
        const row = rowsRef.current[isbn]
        if (row?.status !== "found" || !row.book) continue
        try {
          const saved = await createLocalBook(row.book.ISBN || isbn, {
            Title: row.book.Title,
            Author: row.book.Author,
            Genre: row.book.Genre,
            Status: row.book.Status,
          })
          markAdded(isbn, row.book)
          addedCount += 1
          lastIsbn = saved.ISBN || isbn
          lastTitle = saved.Title
        } catch {
          failed += 1
        }
      }
      if (addedCount > 0) {
        const bits = [`Added ${addedCount} ${addedCount === 1 ? "book" : "books"}`]
        if (skipped) bits.push(`${skipped} already in library`)
        if (failed) bits.push(`${failed} failed`)
        toast.success(bits.join(" · "))
        if (addedCount === 1 && lastIsbn) {
          finishAdded(lastIsbn, lastTitle)
        } else {
          resetForm()
          setBulkMode(false)
        }
      } else if (failed) {
        toast.error("Could not add books.")
      }
    } finally {
      setSaving(false)
    }
  }

  function enableBulk() {
    setBulkMode(true)
    setManualOpen(false)
  }

  function disableBulk() {
    const first = parseIsbnList(raw)[0] ?? ""
    setRaw(first)
    setBulkMode(false)
  }

  if (added) {
    return (
      <PageShell>
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">Added</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {added.title} is on the shelf.
          </p>
        </header>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="h-touch w-full sm:w-auto md:h-8"
            onClick={() => navigateApp(`/books/${encodeURIComponent(added.isbn)}`)}
          >
            Open book
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-touch w-full sm:w-auto md:h-8"
            onClick={startAnother}
          >
            Add another
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-touch w-full sm:w-auto md:h-8"
            onClick={() => navigateApp("/library")}
          >
            Go to library
          </Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Add</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {bulkMode
            ? "Paste several ISBNs, or scan barcodes one after another."
            : canScan
              ? "Scan a barcode or type an ISBN. Title looks up automatically when online."
              : "Type or paste an ISBN. Title looks up automatically when online."}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {canScan && !scanning ? (
          <Button
            type="button"
            size="lg"
            className="h-touch w-full md:h-10"
            onClick={() => setScanning(true)}
          >
            <ScanBarcode data-icon="inline-start" />
            Scan barcode
          </Button>
        ) : null}

        {scanning ? (
          <IsbnBarcodeScanner
            onDetect={(isbn) => {
              if (bulkMode) {
                setRaw((prev) => {
                  const next = appendIsbnToInput(prev, isbn)
                  if (next === prev) {
                    toast.message("Already scanned")
                    return prev
                  }
                  toast.success(`Scanned ${isbn}`)
                  return next
                })
                return
              }
              setRaw(isbn)
              toast.success(`Scanned ${isbn}`)
              setScanning(false)
            }}
            onCancel={() => setScanning(false)}
            onError={(message) => {
              toast.error(message)
              setScanning(false)
            }}
            onInvalid={() => toast.error("Not an ISBN barcode")}
          />
        ) : (
          <FieldGroup>
            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="isbn">
                  {bulkMode ? "ISBNs" : "ISBN"}
                </FieldLabel>
                {bulkMode ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={disableBulk}
                  >
                    One at a time
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    onClick={enableBulk}
                  >
                    Add several
                  </button>
                )}
              </div>
              {bulkMode ? (
                <Textarea
                  id="isbn"
                  name="isbn"
                  value={raw}
                  onChange={(event) => setRaw(event.target.value)}
                  placeholder={"9780143127741\n9780143127742"}
                  autoComplete="off"
                  rows={4}
                />
              ) : (
                <Input
                  id="isbn"
                  name="isbn"
                  value={raw}
                  onChange={(event) => {
                    const value = event.target.value
                    if (parseIsbnList(value).length > 1) {
                      setBulkMode(true)
                    }
                    setRaw(value)
                  }}
                  placeholder="9780143127741"
                  autoComplete="off"
                  inputMode="text"
                  className="h-touch md:h-8"
                />
              )}
              {lookingUp && !scanning ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Looking up…
                </p>
              ) : null}
            </Field>
          </FieldGroup>
        )}

        {scanning ? (
          displayIsbns.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {displayIsbns.length === 1
                ? "1 scanned"
                : `${displayIsbns.length} scanned`}
            </p>
          ) : null
        ) : isBulk || (bulkMode && displayIsbns.length > 0) ? (
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
                {alreadyInLibrary && singleIsbn ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-touch w-full sm:w-auto md:h-8"
                    onClick={() =>
                      navigateApp(`/books/${encodeURIComponent(singleIsbn)}`)
                    }
                  >
                    Open book
                  </Button>
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
                  Enter the title. It syncs to Airtable when you are back online.
                </p>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="manual-title">Title</FieldLabel>
                    <Input
                      id="manual-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      className="h-touch md:h-8"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="manual-author">Author</FieldLabel>
                    <Input
                      id="manual-author"
                      value={author}
                      onChange={(event) => setAuthor(event.target.value)}
                      className="h-touch md:h-8"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="manual-genre">Genre</FieldLabel>
                    <Input
                      id="manual-genre"
                      value={genre}
                      onChange={(event) => setGenre(event.target.value)}
                      className="h-touch md:h-8"
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
            ) : singleIsbn && singleRow?.status === "found" ? (
              <button
                type="button"
                className="self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setManualOpen(true)}
              >
                Edit details before saving
              </button>
            ) : null}
          </>
        )}
      </div>

      {scanning ? null : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {isBulk || (bulkMode && displayIsbns.length > 0) ? (
            <Button
              className="h-touch w-full sm:w-auto md:h-8"
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
            <>
              <Button
                type="submit"
                form="manual-add-form"
                className="h-touch w-full sm:w-auto md:h-8"
                disabled={!singleIsbn || !title.trim() || alreadyInLibrary || saving}
              >
                {saving ? "Saving…" : "Save to library"}
              </Button>
              {singleRow?.status === "error" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-touch w-full sm:w-auto md:h-8"
                  disabled={!singleIsbn || alreadyInLibrary || saving}
                  onClick={() => void handleSaveIsbnOnly()}
                >
                  Save ISBN only
                </Button>
              ) : null}
            </>
          ) : singleRow?.status === "found" && !alreadyInLibrary ? (
            <Button
              className="h-touch w-full sm:w-auto md:h-8"
              onClick={() => void handleSavePreview()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save to library"}
            </Button>
          ) : singleIsbn &&
            !alreadyInLibrary &&
            singleRow?.status !== "pending" &&
            !lookingUp ? (
            <Button
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-touch w-full sm:w-auto md:h-8"
              )}
              onClick={() => void handleSaveIsbnOnly()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save ISBN only"}
            </Button>
          ) : null}
        </div>
      )}
    </PageShell>
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
