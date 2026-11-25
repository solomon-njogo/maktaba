"use client"

import { toast } from "sonner"

import { ApiError } from "@/lib/api/books"
import { updateLocalBook } from "@/lib/offline/books-repository"
import { statusMovePatch } from "@/lib/status"
import type { BookStatus, FormattedBookResponse } from "@/types/books"

export type MovableBook = Pick<
  FormattedBookResponse,
  "ISBN" | "Title" | "Author" | "Status" | "StartDate" | "EndDate"
>

export async function moveBookStatus(
  book: MovableBook,
  nextStatus: BookStatus
): Promise<boolean> {
  if (!book.ISBN || book.Status === nextStatus) return false

  const isbn = book.ISBN
  const title = book.Title
  const previousStatus = book.Status

  try {
    await updateLocalBook(isbn, statusMovePatch(book, nextStatus))
    toast.success(`Moved "${title}" to ${nextStatus}`, {
      action: {
        label: "Undo",
        onClick: () => {
          void updateLocalBook(isbn, { Status: previousStatus })
            .then(() => {
              toast.success(`Moved "${title}" back to ${previousStatus}`)
            })
            .catch((error: unknown) => {
              toast.error(
                error instanceof ApiError
                  ? error.message
                  : "Could not undo status change."
              )
            })
        },
      },
    })
    return true
  } catch (error) {
    toast.error(
      error instanceof ApiError ? error.message : "Could not update status."
    )
    return false
  }
}
