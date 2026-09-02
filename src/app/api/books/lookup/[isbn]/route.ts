import { NextResponse } from "next/server"

import { lookupIsbn, requireIsbn } from "@/lib/server/book.service"
import { jsonError } from "@/lib/server/route-response"

export const maxDuration = 30

type LookupContext = { params: Promise<{ isbn: string }> }

export async function GET(_request: Request, context: LookupContext) {
  try {
    const { isbn: raw } = await context.params
    const isbn = requireIsbn(raw)
    const book = await lookupIsbn(isbn)
    return NextResponse.json(book)
  } catch (error) {
    return jsonError(error)
  }
}
