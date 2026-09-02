import Airtable, { type Base } from "airtable"

import { HttpError } from "./http-error"

let base: Base | null = null

export function getAirtableBase(): Base {
  const apiKey = process.env.AIRTABLE_ACCESS_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID

  if (!apiKey || !baseId) {
    throw new HttpError(
      500,
      "Missing Airtable configuration. Set AIRTABLE_ACCESS_TOKEN and AIRTABLE_BASE_ID."
    )
  }

  if (!base) {
    base = new Airtable({ apiKey }).base(baseId)
  }

  return base
}
