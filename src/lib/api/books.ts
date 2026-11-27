import type {
  BookCreatePayload,
  BookStatus,
  BookUpdatePayload,
  FormattedBookResponse,
} from "@/types/books"

export type ApiErrorOptions = {
  retryAfterMs?: number
  isJsonResponse?: boolean
}

export class ApiError extends Error {
  status: number
  retryAfterMs?: number
  isJsonResponse: boolean

  constructor(status: number, message: string, options?: ApiErrorOptions) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.retryAfterMs = options?.retryAfterMs
    this.isJsonResponse = options?.isJsonResponse ?? true
  }
}

export const CATALOG_BUDGET_MS = 15_000
export const SYNC_WRITE_BUDGET_MS = 20_000
export const SYNC_LOOKUP_CREATE_BUDGET_MS = 25_000

export function parseRetryAfterMs(header: string | null): number | undefined {
  if (header === null || header.trim() === "") return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000)
  }
  const timestamp = Date.parse(header)
  if (Number.isFinite(timestamp)) {
    return Math.max(0, timestamp - Date.now())
  }
  return undefined
}

function createTimeoutSignal(ms: number): {
  signal: AbortSignal
  didTimeout: () => boolean
  cleanup: () => void
} {
  let timedOut = false
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    const signal = AbortSignal.timeout(ms)
    const onAbort = () => {
      if (
        signal.reason instanceof Error &&
        signal.reason.name === "TimeoutError"
      ) {
        timedOut = true
      }
    }
    signal.addEventListener("abort", onAbort, { once: true })
    return {
      signal,
      didTimeout: () =>
        timedOut ||
        (signal.aborted &&
          signal.reason instanceof Error &&
          signal.reason.name === "TimeoutError"),
      cleanup: () => signal.removeEventListener("abort", onAbort),
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => {
    timedOut = true
    const error = new Error("Request timed out. Will retry shortly.")
    error.name = "TimeoutError"
    controller.abort(error)
  }, ms)

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => clearTimeout(timer),
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  budgetMs?: number
): Promise<T> {
  const method = init?.method ?? "GET"
  const timeoutMs =
    budgetMs ?? (method === "GET" ? CATALOG_BUDGET_MS : SYNC_WRITE_BUDGET_MS)
  const timeout = init?.signal ? null : createTimeoutSignal(timeoutMs)

  let response: Response
  let text: string
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
      signal: init?.signal ?? timeout?.signal,
    })
    text = await response.text()
  } catch (error) {
    if (
      timeout?.didTimeout() ||
      (error instanceof Error && error.name === "TimeoutError")
    ) {
      const timeoutError = new Error("Request timed out. Will retry shortly.")
      timeoutError.name = "TimeoutError"
      throw timeoutError
    }
    throw error
  } finally {
    timeout?.cleanup()
  }

  const trimmed = text.trim()
  let body: { error?: string } | null = null
  let parsed = false
  if (trimmed) {
    try {
      body = JSON.parse(trimmed) as { error?: string }
      parsed = body !== null && typeof body === "object"
    } catch {
      parsed = false
    }
  }

  const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"))

  if (!response.ok) {
    const snippet = trimmed
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180)
    throw new ApiError(
      response.status,
      (parsed && body?.error) || snippet || response.statusText || "Request failed.",
      {
        retryAfterMs,
        isJsonResponse: parsed,
      }
    )
  }

  if (!trimmed || !parsed) {
    throw new ApiError(502, "The library returned an unreadable response.", {
      retryAfterMs,
      isJsonResponse: false,
    })
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
  const hasTitle = Boolean(extras?.Title?.trim())
  return request<FormattedBookResponse>(
    "/api/books",
    {
      method: "POST",
      body: JSON.stringify({ isbn, ...extras }),
    },
    hasTitle ? SYNC_WRITE_BUDGET_MS : SYNC_LOOKUP_CREATE_BUDGET_MS
  )
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
    },
    SYNC_WRITE_BUDGET_MS
  )
}

export function removeBook(isbn: string, recordId?: string) {
  return request<FormattedBookResponse>(
    `/api/books/${encodeURIComponent(isbn)}`,
    { method: "DELETE", headers: recordHeaders(recordId) },
    SYNC_WRITE_BUDGET_MS
  )
}
