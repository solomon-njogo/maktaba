import { NextResponse } from "next/server"

import type { BookUpdatePayload } from "@/types/books"
import {
  getLibraryBookByIsbn,
  requireIsbn,
  softDeleteBook,
  updateBook,
} from "@/lib/server/book.service"
import { jsonError } from "@/lib/server/route-response"

type BookContext = { params: Promise<{ isbn: string }> }

export async function GET(_request: Request, context: BookContext) {
  try {
    const { isbn: raw } = await context.params
    const isbn = requireIsbn(raw)
    const book = await getLibraryBookByIsbn(isbn)
    return NextResponse.json(book)
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request, context: BookContext) {
  try {
    const { isbn: raw } = await context.params
    const isbn = requireIsbn(raw)
    const patch = (await request.json().catch(() => ({}))) as BookUpdatePayload
    const book = await updateBook(isbn, patch ?? {})
    return NextResponse.json(book)
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_request: Request, context: BookContext) {
  try {
    const { isbn: raw } = await context.params
    const isbn = requireIsbn(raw)
    const book = await softDeleteBook(isbn)
    return NextResponse.json(book)
  } catch (error) {
    return jsonError(error)
  }
}
