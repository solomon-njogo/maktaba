import { NextResponse } from "next/server"

import { AirtableRequestError } from "./airtable"
import { HttpError } from "./http-error"

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof AirtableRequestError) {
    console.error("Airtable request failed", {
      status: error.status,
      type: error.error?.type,
      message: error.message,
    })

    if (error.status === 429) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds ?? 30),
          },
        }
      )
    }

    if (error.status === 504 || error.status === 408) {
      return NextResponse.json(
        { error: "Airtable took too long. Will retry shortly." },
        { status: 504 }
      )
    }

    if (error.status === 422) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }

    return NextResponse.json(
      { error: "Library storage is temporarily unavailable. Will retry shortly." },
      { status: 502 }
    )
  }

  console.error(error)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  )
}
