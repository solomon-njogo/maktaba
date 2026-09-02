import { NextResponse } from "next/server"

import { createBook, listBooks, requireIsbn } from "@/lib/server/book.service"
import { jsonError } from "@/lib/server/route-response"

export const maxDuration = 30

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") ?? undefined
    const borrowed = searchParams.get("borrowed") ?? undefined
    const books = await listBooks({ status, borrowed })
    return NextResponse.json(books)
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { isbn?: string; ISBN?: string }
      | null
    const isbn = requireIsbn(body?.isbn ?? body?.ISBN)
    const book = await createBook(isbn)
    return NextResponse.json(book, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
