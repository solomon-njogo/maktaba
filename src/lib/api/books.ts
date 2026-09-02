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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })

  const text = await response.text()
  const body = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body && body.error) || "Request failed."
    )
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

export function updateBook(isbn: string, patch: BookUpdatePayload) {
  return request<FormattedBookResponse>(
    `/api/books/${encodeURIComponent(isbn)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    }
  )
}

export function removeBook(isbn: string) {
  return request<FormattedBookResponse>(
    `/api/books/${encodeURIComponent(isbn)}`,
    { method: "DELETE" }
  )
}
