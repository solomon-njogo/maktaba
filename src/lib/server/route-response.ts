import { NextResponse } from "next/server"

import { HttpError } from "./http-error"

function httpStatus(error: unknown): number | undefined {
  if (error instanceof HttpError) return error.status
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status <= 599
  ) {
    return error.status
  }
  return undefined
}

export function jsonError(error: unknown) {
  const status = httpStatus(error)
  if (status && error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status })
  }

  console.error(error)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}
