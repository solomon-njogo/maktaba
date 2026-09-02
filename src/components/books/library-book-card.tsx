"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import type { BookStatus, FormattedBookResponse } from "@/types/books"
import { BookCard } from "@/components/books/book-card"
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/books"
import {
  removeLocalBook,
  updateLocalBook,
} from "@/lib/offline/books-repository"

const STATUSES: BookStatus[] = ["TBR", "Reading", "Done", "To-Buy"]

export function LibraryBookCard({ book }: { book: FormattedBookResponse }) {
  const router = useRouter()
  const isbn = book.ISBN
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [borrowedBy, setBorrowedBy] = useState(book.BorrowedBy ?? "")
  const [borrowedOn, setBorrowedOn] = useState(book.BorrowedOn ?? "")
  const [borrowedUntil, setBorrowedUntil] = useState(book.BorrowedUntil ?? "")
  const [pending, setPending] = useState(false)

  async function patch(label: string, payload: Parameters<typeof updateLocalBook>[1]) {
    if (!isbn) return
    setPending(true)
    try {
      await updateLocalBook(isbn, payload)
      toast.success(label)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Update failed.")
    } finally {
      setPending(false)
    }
  }

  async function handleReturn() {
    await patch("Marked as returned", { Borrowed: "No" })
  }

  async function handleBorrow(event: React.FormEvent) {
    event.preventDefault()
    await patch("Tagged as borrowed", {
      Borrowed: "Yes",
      BorrowedBy: borrowedBy.trim(),
      BorrowedOn: borrowedOn || undefined,
      BorrowedUntil: borrowedUntil || undefined,
    })
    setBorrowOpen(false)
  }

  async function handleDelete() {
    if (!isbn) return
    setPending(true)
    try {
      await removeLocalBook(isbn)
      toast.success(`Removed ${book.Title}`)
      setDeleteOpen(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Remove failed.")
    } finally {
      setPending(false)
    }
  }

  const href = isbn ? `/books/${encodeURIComponent(isbn)}` : null

  return (
    <div className="relative">
      {href ? (
        <Link
          href={href}
          className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BookCard
            className="pr-10 transition-colors hover:bg-muted/40"
            book={{
              Title: book.Title,
              Author: book.Author,
              Status: book.Status,
              Borrowed: book.Borrowed,
              BorrowedBy: book.BorrowedBy,
              coverUrl: book.coverUrl ?? book.Thumbnail,
            }}
          />
        </Link>
      ) : (
        <BookCard
          className="pr-10"
          book={{
            Title: book.Title,
            Author: book.Author,
            Status: book.Status,
            Borrowed: book.Borrowed,
            BorrowedBy: book.BorrowedBy,
            coverUrl: book.coverUrl ?? book.Thumbnail,
          }}
        />
      )}
      {isbn ? (
        <div className="absolute top-3 right-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" disabled={pending} />}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">Actions for {book.Title}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => router.push(`/books/${encodeURIComponent(isbn)}`)}
                >
                  View details
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {STATUSES.map((status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={book.Status === status || pending}
                    onClick={() => patch(`Marked as ${status}`, { Status: status })}
                  >
                    {status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {book.Borrowed === "Yes" ? (
                  <DropdownMenuItem disabled={pending} onClick={handleReturn}>
                    Mark returned
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={pending}
                    onClick={() => setBorrowOpen(true)}
                  >
                    Tag as borrowed
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setDeleteOpen(true)}
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <Dialog open={borrowOpen} onOpenChange={setBorrowOpen}>
        <DialogContent>
          <form onSubmit={handleBorrow} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Tag as borrowed</DialogTitle>
              <DialogDescription>
                Who has {book.Title}, and when should it come back?
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`borrowed-by-${isbn}`}>Borrowed by</FieldLabel>
                <Input
                  id={`borrowed-by-${isbn}`}
                  value={borrowedBy}
                  onChange={(event) => setBorrowedBy(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`borrowed-on-${isbn}`}>Borrowed on</FieldLabel>
                <Input
                  id={`borrowed-on-${isbn}`}
                  type="date"
                  value={borrowedOn}
                  onChange={(event) => setBorrowedOn(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`borrowed-until-${isbn}`}>
                  Borrowed until
                </FieldLabel>
                <Input
                  id={`borrowed-until-${isbn}`}
                  type="date"
                  value={borrowedUntil}
                  onChange={(event) => setBorrowedUntil(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending || !borrowedBy.trim()}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
