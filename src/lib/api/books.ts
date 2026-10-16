import type {
  BookCreatePayload,
  BookStatus,
  BookUpdatePayload,
  FormattedBookResponse,
} from "@/types/books"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

const SYNC_BUDGET_MS = 2500
const CATALOG_BUDGET_MS = 8000

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET"
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal:
      init?.signal ??
      AbortSignal.timeout(method === "GET" ? CATALOG_BUDGET_MS : SYNC_BUDGET_MS),
  })

  const text = await response.text()
  let body: { error?: string } | null = null
  let parsed = !text
  if (text) {
    try {
      body = JSON.parse(text) as { error?: string }
      parsed = true
    } catch {
      parsed = false
    }
  }

  if (!response.ok) {
    const snippet = text
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180)
    throw new ApiError(
      response.status,
      (parsed && body?.error) || snippet || response.statusText || "Request failed."
    )
  }

  if (!parsed) {
    throw new ApiError(response.status, "The library returned an unreadable response.")
  }

  return body as T
}

export type ListBooksFilters = {
  status?: BookStatus
  borrowed?: "Yes" | "No"
}

export function listBooks(filters: ListBooksFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set("status", filters.status)
  if (filters.borrowed) params.set("borrowed", filters.borrowed)
  const query = params.toString()
  return request<FormattedBookResponse[]>(
    `/api/books${query ? `?${query}` : ""}`
  )
}

export function lookupBook(isbn: string) {
  return request<FormattedBookResponse>(
    `/api/books/lookup/${encodeURIComponent(isbn)}`
  )
}

export function getBook(isbn: string) {
  return request<FormattedBookResponse>(
    `/api/books/${encodeURIComponent(isbn)}`
  )
}

export function addBook(isbn: string, extras?: BookCreatePayload) {
  return request<FormattedBookResponse>("/api/books", {
    method: "POST",
    body: JSON.stringify({ isbn, ...extras }),
  })
}

function recordHeaders(recordId?: string): HeadersInit | undefined {
  const id = recordId?.trim()
  return id ? { "x-record-id": id } : undefined
}

export function updateBook(
  isbn: string,
  patch: BookUpdatePayload,
  recordId?: string
) {
  return request<FormattedBookResponse>(
    `/api/books/${encodeURIComponent(isbn)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: recordHeaders(recordId),
    }
  )
}

export function removeBook(isbn: string, recordId?: string) {
  return request<FormattedBookResponse>(
    `/api/books/${encodeURIComponent(isbn)}`,
    { method: "DELETE", headers: recordHeaders(recordId) }
  )
}
