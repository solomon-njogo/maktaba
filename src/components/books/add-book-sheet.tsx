"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { BookCard } from "@/components/books/book-card"
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
import { ApiError, addBook, lookupBook } from "@/lib/api/books"
import type { FormattedBookResponse } from "@/api/types/books"

export function AddBookSheet() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isbn, setIsbn] = useState("")
  const [preview, setPreview] = useState<FormattedBookResponse | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setIsbn("")
    setPreview(null)
    setLookupError(null)
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
    try {
      const book = await lookupBook(value)
      setPreview(book)
    } catch (error) {
      setLookupError(
        error instanceof ApiError ? error.message : "Lookup failed."
      )
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSave() {
    if (!preview?.ISBN && !isbn.trim()) return
    setSaving(true)
    try {
      const saved = await addBook(preview?.ISBN || isbn.trim())
      toast.success(`Added ${saved.Title}`)
      setOpen(false)
      reset()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not add book.")
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
      <SheetTrigger render={<Button size="sm" />}>Add book</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add by ISBN</SheetTitle>
          <SheetDescription>
            Look up a title, review the metadata, then save it as TBR.
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
              {preview.inLibrary ? (
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
        </div>
        <SheetFooter>
          <Button
            onClick={handleSave}
            disabled={!preview || preview.inLibrary || saving}
          >
            {saving ? "Saving…" : "Save to library"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
