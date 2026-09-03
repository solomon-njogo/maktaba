"use client"

import { useState } from "react"
import Image from "next/image"
import { ArrowLeftIcon, BookOpenIcon } from "lucide-react"
import { toast } from "sonner"

import type {
  BookStatus,
  BookUpdatePayload,
  BorrowedFlag,
  FormattedBookResponse,
} from "@/types/books"
import { StatusBadge } from "@/components/books/status-badge"
import { AppLink } from "@/components/offline/app-link"
import { PageShell } from "@/components/layout/page-shell"
import { navigateApp } from "@/lib/offline/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/books"
import {
  removeLocalBook,
  updateLocalBook,
} from "@/lib/offline/books-repository"
import { cn } from "@/lib/utils"

const STATUSES: BookStatus[] = ["TBR", "Reading", "Done", "To-Buy"]

type BookFormState = {
  Title: string
  Author: string
  Genre: string
  Status: BookStatus
  StartDate: string
  EndDate: string
  Borrowed: BorrowedFlag
  BorrowedBy: string
  BorrowedOn: string
  BorrowedUntil: string
}

function asDateInput(value?: string) {
  return value?.slice(0, 10) ?? ""
}

function formFromBook(book: FormattedBookResponse): BookFormState {
  return {
    Title: book.Title,
    Author: book.Author,
    Genre: book.Genre ?? "",
    Status: book.Status,
    StartDate: asDateInput(book.StartDate),
    EndDate: asDateInput(book.EndDate),
    Borrowed: book.Borrowed ?? "No",
    BorrowedBy: book.BorrowedBy ?? "",
    BorrowedOn: asDateInput(book.BorrowedOn),
    BorrowedUntil: asDateInput(book.BorrowedUntil),
  }
}

function displayDate(value?: string) {
  const iso = asDateInput(value)
  if (!iso) return "—"
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border/70 py-3 last:border-b-0 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-sm wrap-break-word">{value}</dd>
    </div>
  )
}

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"

export function BookDetail({
  book,
}: {
  book: FormattedBookResponse & { pending?: boolean }
}) {
  const isbn = book.ISBN
  const coverUrl = book.coverUrl ?? book.Thumbnail
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => formFromBook(book))
  const [formBook, setFormBook] = useState(book)
  const [pending, setPending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (book !== formBook) {
    setFormBook(book)
    setForm(formFromBook(book))
  }

  function updateField<K extends keyof BookFormState>(
    key: K,
    value: BookFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!isbn) return
    if (!form.Title.trim()) {
      toast.error("Title is required.")
      return
    }
    if (form.Borrowed === "Yes" && !form.BorrowedBy.trim()) {
      toast.error("Who borrowed this title?")
      return
    }

    const payload: BookUpdatePayload = {
      Title: form.Title.trim(),
      Author: form.Author.trim(),
      Genre: form.Genre.trim(),
      Status: form.Status,
      Borrowed: form.Borrowed,
    }

    if (form.StartDate) payload.StartDate = form.StartDate
    if (form.EndDate) payload.EndDate = form.EndDate

    if (form.Borrowed === "Yes") {
      payload.BorrowedBy = form.BorrowedBy.trim()
      if (form.BorrowedOn) payload.BorrowedOn = form.BorrowedOn
      if (form.BorrowedUntil) payload.BorrowedUntil = form.BorrowedUntil
    }

    setPending(true)
    try {
      await updateLocalBook(isbn, payload)
      toast.success("Saved changes")
      setEditing(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Update failed.")
    } finally {
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!isbn) return
    setPending(true)
    try {
      await removeLocalBook(isbn)
      toast.success(`Removed ${book.Title}`)
      navigateApp("/")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Remove failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <PageShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AppLink
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2"
          )}
        >
          <ArrowLeftIcon />
          Library
        </AppLink>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setForm(formFromBook(book))
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" form="book-edit-form" disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!isbn}
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={!isbn || pending}
                onClick={() => setDeleteOpen(true)}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="relative mx-auto aspect-[2/3] w-full max-w-56 overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:max-w-64 lg:mx-0 lg:w-56 lg:max-w-none">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`Cover of ${book.Title}`}
              fill
              sizes="(max-width: 1024px) 256px, 224px"
              className="object-cover"
              unoptimized
              priority
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
              <BookOpenIcon className="size-10" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <form id="book-edit-form" onSubmit={handleSave} className="flex flex-col gap-8">
              <FieldSet>
                <FieldLegend>Catalog</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="book-title">Title</FieldLabel>
                    <Input
                      id="book-title"
                      value={form.Title}
                      onChange={(event) => updateField("Title", event.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="book-author">Author</FieldLabel>
                    <Input
                      id="book-author"
                      value={form.Author}
                      onChange={(event) => updateField("Author", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="book-genre">Genre</FieldLabel>
                    <Input
                      id="book-genre"
                      value={form.Genre}
                      onChange={(event) => updateField("Genre", event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="book-isbn">ISBN</FieldLabel>
                    <Input id="book-isbn" value={isbn ?? ""} disabled />
                    <FieldDescription>ISBN is the lookup key and cannot be changed.</FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Reading</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="book-status">Status</FieldLabel>
                    <select
                      id="book-status"
                      className={selectClassName}
                      value={form.Status}
                      onChange={(event) =>
                        updateField("Status", event.target.value as BookStatus)
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="book-start">Started</FieldLabel>
                      <Input
                        id="book-start"
                        type="date"
                        value={form.StartDate}
                        onChange={(event) =>
                          updateField("StartDate", event.target.value)
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="book-end">Finished</FieldLabel>
                      <Input
                        id="book-end"
                        type="date"
                        value={form.EndDate}
                        onChange={(event) =>
                          updateField("EndDate", event.target.value)
                        }
                      />
                    </Field>
                  </div>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Loan</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="book-borrowed">Borrowed</FieldLabel>
                    <select
                      id="book-borrowed"
                      className={selectClassName}
                      value={form.Borrowed}
                      onChange={(event) =>
                        updateField("Borrowed", event.target.value as BorrowedFlag)
                      }
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </Field>
                  {form.Borrowed === "Yes" ? (
                    <>
                      <Field>
                        <FieldLabel htmlFor="book-borrowed-by">Borrowed by</FieldLabel>
                        <Input
                          id="book-borrowed-by"
                          value={form.BorrowedBy}
                          onChange={(event) =>
                            updateField("BorrowedBy", event.target.value)
                          }
                          required
                        />
                      </Field>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor="book-borrowed-on">Borrowed on</FieldLabel>
                          <Input
                            id="book-borrowed-on"
                            type="date"
                            value={form.BorrowedOn}
                            onChange={(event) =>
                              updateField("BorrowedOn", event.target.value)
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor="book-borrowed-until">
                            Borrowed until
                          </FieldLabel>
                          <Input
                            id="book-borrowed-until"
                            type="date"
                            value={form.BorrowedUntil}
                            onChange={(event) =>
                              updateField("BorrowedUntil", event.target.value)
                            }
                          />
                        </Field>
                      </div>
                    </>
                  ) : null}
                </FieldGroup>
              </FieldSet>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <header className="flex flex-col gap-3">
                <h1 className="text-2xl wrap-break-word sm:text-3xl">{book.Title}</h1>
                <p className="text-muted-foreground">{book.Author || "Unknown author"}</p>
                <StatusBadge status={book.Status} borrowed={book.Borrowed} />
                {book.pending ? (
                  <p className="text-xs text-muted-foreground">Waiting to sync</p>
                ) : null}
              </header>
              <dl>
                <DetailRow label="ISBN" value={isbn || "—"} />
                <DetailRow label="Genre" value={book.Genre || "—"} />
                <DetailRow label="Started" value={displayDate(book.StartDate)} />
                <DetailRow label="Finished" value={displayDate(book.EndDate)} />
                <DetailRow label="Added" value={displayDate(book.DateAdded)} />
                <DetailRow
                  label="Borrowed by"
                  value={
                    book.Borrowed === "Yes"
                      ? book.BorrowedBy || "Unnamed"
                      : "—"
                  }
                />
                <DetailRow label="Borrowed on" value={displayDate(book.BorrowedOn)} />
                <DetailRow
                  label="Borrowed until"
                  value={displayDate(book.BorrowedUntil)}
                />
              </dl>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {book.Title}?</AlertDialogTitle>
            <AlertDialogDescription>
              The title is hidden from the library. It can be restored by adding
              the same ISBN later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
