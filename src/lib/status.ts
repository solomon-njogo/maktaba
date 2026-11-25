import type {
  BookStatus,
  BookUpdatePayload,
  FormattedBookResponse,
} from "@/types/books"

export const BOOK_STATUSES = ["To-Buy", "TBR", "Reading", "Done"] as const

export const STATUS_META: Record<
  BookStatus,
  { label: string; description: string }
> = {
  "To-Buy": { label: "To-Buy", description: "Plan to acquire" },
  TBR: { label: "TBR", description: "On the shelf, next up" },
  Reading: { label: "Reading", description: "Currently reading" },
  Done: { label: "Done", description: "Finished" },
}

export type NextStatusAction = {
  status: BookStatus
  label: string
}

export function nextStatusAction(status: BookStatus): NextStatusAction | null {
  switch (status) {
    case "To-Buy":
      return { status: "TBR", label: "Move to TBR" }
    case "TBR":
      return { status: "Reading", label: "Start reading" }
    case "Reading":
      return { status: "Done", label: "Mark done" }
    case "Done":
      return null
  }
}

export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function formatCalendarDate(value?: string): string {
  const iso = value?.slice(0, 10) ?? ""
  if (!iso) return ""
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function statusMovePatch(
  book: Pick<FormattedBookResponse, "Status" | "StartDate" | "EndDate">,
  nextStatus: BookStatus,
  today = localToday()
): BookUpdatePayload {
  const patch: BookUpdatePayload = { Status: nextStatus }
  if (nextStatus === "Reading" && !book.StartDate) {
    patch.StartDate = today
  }
  if (nextStatus === "Done" && !book.EndDate) {
    patch.EndDate = today
  }
  return patch
}
