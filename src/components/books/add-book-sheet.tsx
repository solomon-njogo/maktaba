"use client"

import { useMemo, useState } from "react"
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
import { ApiError, lookupBook } from "@/lib/api/books"
import { useMdUp } from "@/hooks/use-md-up"
import { cleanIsbnString } from "@/lib/isbn"
import { createLocalBook } from "@/lib/offline/books-repository"
import type { BookStatus, FormattedBookResponse } from "@/types/books"

const STATUSES: BookStatus[] = ["TBR", "Reading", "Done", "To-Buy"]

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"

export function AddBookSheet() {
  const mdUp = useMdUp()
  const { books } = useLibrary()
  const [open, setOpen] = useState(false)
  const [isbn, setIsbn] = useState("")
  const [preview, setPreview] = useState<FormattedBookResponse | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [author, setAuthor] = useState("")
  const [genre, setGenre] = useState("")
  const [status, setStatus] = useState<BookStatus>("TBR")
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)

  const localMatch = useMemo(() => {
    const key = cleanIsbnString(isbn)
    if (!key) return undefined
    return books.find((book) => book.ISBN === key)
  }, [books, isbn])

  function reset() {
    setIsbn("")
    setPreview(null)
    setLookupError(null)
    setManualOpen(false)
    setTitle("")
    setAuthor("")
    setGenre("")
    setStatus("TBR")
    setLookingUp(false)
    setSaving(false)
  }

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault()
    const value = isbn.trim()
    if (!value) return
    setLookingUp(true)
    setLookupError(null)
    setPreview(null)

    const existing = localMatch
    if (existing) {
      setPreview({ ...existing, inLibrary: true })
      setLookingUp(false)
      return
    }

    const online = typeof navigator === "undefined" ? true : navigator.onLine
    if (!online) {
      setLookupError("Catalog lookup needs a network. Enter the title below, or save the ISBN to look up later.")
      setManualOpen(true)
      setLookingUp(false)
      return
    }

    try {
      const book = await lookupBook(value)
      setPreview(book)
      if (!book.inLibrary) {
        setTitle(book.Title)
        setAuthor(book.Author)
        setGenre(book.Genre ?? "")
        setStatus(book.Status)
      }
    } catch (error) {
      setLookupError(
        error instanceof ApiError ? error.message : "Lookup failed."
      )
      setManualOpen(true)
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSavePreview() {
    if (!preview?.ISBN && !isbn.trim()) return
    setSaving(true)
    try {
      const saved = await createLocalBook(preview?.ISBN || isbn.trim(), {
        Title: preview?.Title,
        Author: preview?.Author,
        Genre: preview?.Genre,
        Status: preview?.Status,
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
    if (!isbn.trim()) return
    setSaving(true)
    try {
      const saved = await createLocalBook(isbn.trim())
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
    if (!isbn.trim() || !title.trim()) return
    setSaving(true)
    try {
      const saved = await createLocalBook(isbn.trim(), {
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

  const alreadyInLibrary = Boolean(preview?.inLibrary || localMatch)

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
            Look up a title when online, or enter details and save offline.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <form onSubmit={handleLookup}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="isbn">ISBN</FieldLabel>
                <Input
                  id="isbn"
                  name="isbn"
                  value={isbn}
                  onChange={(event) => setIsbn(event.target.value)}
                  placeholder="9780143127741"
                  autoComplete="off"
                />
              </Field>
              <Button type="submit" variant="outline" disabled={lookingUp || !isbn.trim()}>
                {lookingUp ? "Looking up…" : "Look up"}
              </Button>
            </FieldGroup>
          </form>
          {lookupError ? (
            <p className="text-sm text-destructive">{lookupError}</p>
          ) : null}
          {preview ? (
            <div className="flex flex-col gap-3">
              {alreadyInLibrary ? (
                <p className="text-sm text-muted-foreground">
                  This ISBN is already in the library.
                </p>
              ) : null}
              <BookCard
                book={{
                  Title: preview.Title,
                  Author: preview.Author,
                  Status: preview.Status,
                  Borrowed: preview.Borrowed,
                  BorrowedBy: preview.BorrowedBy,
                  coverUrl: preview.coverUrl ?? preview.Thumbnail,
                }}
              />
              {preview.Genre ? (
                <p className="text-sm text-muted-foreground">Genre: {preview.Genre}</p>
              ) : null}
            </div>
          ) : null}
          {manualOpen ? (
            <form id="manual-add-form" onSubmit={handleSaveManual} className="flex flex-col gap-3">
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
                    onChange={(event) => setStatus(event.target.value as BookStatus)}
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
        </div>
        <SheetFooter>
          {manualOpen ? (
            <Button
              type="submit"
              form="manual-add-form"
              disabled={!isbn.trim() || !title.trim() || alreadyInLibrary || saving}
            >
              {saving ? "Saving…" : "Save to library"}
            </Button>
          ) : preview && !alreadyInLibrary ? (
            <Button onClick={handleSavePreview} disabled={saving}>
              {saving ? "Saving…" : "Save to library"}
            </Button>
          ) : (
            <Button
              onClick={handleSaveIsbnOnly}
              disabled={!isbn.trim() || alreadyInLibrary || saving}
              variant={preview ? "default" : "outline"}
            >
              {saving ? "Saving…" : "Save ISBN for later lookup"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
