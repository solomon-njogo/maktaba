import { NextResponse } from "next/server"

import { HttpError } from "./http-error"

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(error)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}
