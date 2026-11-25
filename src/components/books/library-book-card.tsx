"use client"

import { useState } from "react"
import { ArrowRightIcon, CheckIcon, MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import type { BookStatus, FormattedBookResponse } from "@/types/books"
import { BookCover } from "@/components/books/book-card"
import { moveBookStatus } from "@/components/books/move-book-status"
import { BorrowedBadge, StatusBadge } from "@/components/books/status-badge"
import { QuickStatusPicker } from "@/components/books/status-picker"
import { AppLink } from "@/components/offline/app-link"
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
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { navigateApp } from "@/lib/offline/navigation"
import { formatCalendarDate, nextStatusAction } from "@/lib/status"

export function LibraryBookCard({ book }: { book: FormattedBookResponse }) {
  const isbn = book.ISBN
  const [borrowOpen, setBorrowOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [borrowedBy, setBorrowedBy] = useState(book.BorrowedBy ?? "")
  const [borrowedOn, setBorrowedOn] = useState(book.BorrowedOn ?? "")
  const [borrowedUntil, setBorrowedUntil] = useState(book.BorrowedUntil ?? "")
  const [pending, setPending] = useState(false)

  async function patch(
    label: string,
    payload: Parameters<typeof updateLocalBook>[1]
  ) {
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

  async function handleQuickMove(nextStatus: BookStatus) {
    if (!isbn || pending) return
    setPending(true)
    try {
      await moveBookStatus(book, nextStatus)
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
  const nextAction = nextStatusAction(book.Status)
  const borrowedLine =
    book.Borrowed === "Yes"
      ? book.BorrowedBy
        ? `With ${book.BorrowedBy}`
        : "Out on loan"
      : null

  const cardBody = (
    <CardContent className="py-3 pr-12 md:pr-10">
      <div className="flex flex-row items-start gap-3 sm:gap-4">
        <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10 sm:w-20">
          <BookCover
            coverUrl={book.coverUrl ?? book.Thumbnail}
            sizes="(max-width: 640px) 64px, 80px"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <CardHeader className="px-0">
            <CardTitle>{book.Title}</CardTitle>
            {book.Author ? (
              <CardDescription>{book.Author}</CardDescription>
            ) : null}
          </CardHeader>
          {isbn ? (
            book.Borrowed === "Yes" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <BorrowedBadge />
                {borrowedLine ? (
                  <p className="text-xs text-muted-foreground">{borrowedLine}</p>
                ) : null}
              </div>
            ) : null
          ) : (
            <>
              <StatusBadge status={book.Status} borrowed={book.Borrowed} />
              {borrowedLine ? (
                <p className="text-xs text-muted-foreground">{borrowedLine}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </CardContent>
  )

  return (
    <>
      <Card size="sm" className="w-full gap-0 py-0">
        <div className="relative">
          {href ? (
            <AppLink
              href={href}
              className="block rounded-t-xl transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {cardBody}
            </AppLink>
          ) : (
            cardBody
          )}
          {isbn ? (
            <div className="absolute top-2 right-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      className="min-h-touch min-w-touch md:min-h-7 md:min-w-7"
                    />
                  }
                >
                  <MoreHorizontalIcon />
                  <span className="sr-only">Actions for {book.Title}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={pending}
                      onClick={() =>
                        navigateApp(`/books/${encodeURIComponent(isbn)}`)
                      }
                    >
                      View details
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {book.Borrowed === "Yes" ? (
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={handleReturn}
                      >
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
        </div>

        {isbn ? (
          <CardFooter className="flex-wrap justify-between gap-2 border-border/60 bg-muted/30 px-3 py-2">
            <QuickStatusPicker book={book} disabled={pending} />
            {nextAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void handleQuickMove(nextAction.status)}
                className="h-touch rounded-full bg-background/90 px-3.5 text-xs font-medium shadow-xs md:h-8 md:px-3"
              >
                {nextAction.label}
                {nextAction.status === "Done" ? (
                  <CheckIcon data-icon="inline-end" />
                ) : (
                  <ArrowRightIcon data-icon="inline-end" />
                )}
              </Button>
            ) : book.EndDate ? (
              <span className="truncate text-xs text-muted-foreground">
                Finished {formatCalendarDate(book.EndDate)}
              </span>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>

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
                <FieldLabel htmlFor={`borrowed-by-${isbn}`}>
                  Borrowed by
                </FieldLabel>
                <Input
                  id={`borrowed-by-${isbn}`}
                  value={borrowedBy}
                  onChange={(event) => setBorrowedBy(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`borrowed-on-${isbn}`}>
                  Borrowed on
                </FieldLabel>
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
    </>
  )
}
