"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { getBook } from "@/lib/api/books"
import { getAllBooks } from "@/lib/offline/db"
import { subscribeLibrary } from "@/lib/offline/events"
import { filterBooks } from "@/lib/offline/books-repository"
import { readSyncStatus, startOfflineSync } from "@/lib/offline/sync"
import type { LocalBook, SyncStatus } from "@/lib/offline/types"
import type { ListBooksFilters } from "@/lib/api/books"

type LibraryContextValue = {
  books: LocalBook[]
  ready: boolean
  status: SyncStatus
  booksFor: (filters?: ListBooksFilters) => LocalBook[]
  bookByIsbn: (isbn: string) => LocalBook | undefined
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

const idleStatus: SyncStatus = {
  online: true,
  syncing: false,
  pendingCount: 0,
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<LocalBook[]>([])
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<SyncStatus>(idleStatus)

  const refresh = useCallback(async () => {
    try {
      const [all, nextStatus] = await Promise.all([getAllBooks(), readSyncStatus()])
      setBooks(all)
      setStatus(nextStatus)
    } catch {
      setStatus((current) => ({
        ...current,
        online: typeof navigator === "undefined" ? true : navigator.onLine,
      }))
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    startOfflineSync()
    const unsubscribe = subscribeLibrary(() => {
      void refresh()
    })
    const timer = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => {
      unsubscribe()
      window.clearTimeout(timer)
    }
  }, [refresh])

  const value = useMemo<LibraryContextValue>(
    () => ({
      books,
      ready,
      status,
      booksFor: (filters) => filterBooks(books, filters),
      bookByIsbn: (isbn) =>
        books.find((book) => book.ISBN === isbn && !book.deleted),
    }),
    [books, ready, status]
  )

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  )
}

export function useLibrary(filters?: ListBooksFilters) {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error("useLibrary must be used within LibraryProvider")
  }
  return {
    books: context.booksFor(filters),
    ready: context.ready,
    status: context.status,
  }
}

export function useLibraryStatus() {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error("useLibraryStatus must be used within LibraryProvider")
  }
  return context.status
}

export function useBook(isbn: string | undefined) {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error("useBook must be used within LibraryProvider")
  }

  const local = isbn ? context.bookByIsbn(isbn) : undefined
  const [missedIsbn, setMissedIsbn] = useState<string | null>(null)
  const [loadingIsbn, setLoadingIsbn] = useState<string | null>(null)

  useEffect(() => {
    if (!isbn || local || !context.ready) return

    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          if (!cancelled) setMissedIsbn(isbn)
          return
        }
        setLoadingIsbn(isbn)
        try {
          const book = await getBook(isbn)
          if (cancelled) return
          const { upsertRemoteBook } = await import(
            "@/lib/offline/books-repository"
          )
          await upsertRemoteBook(book)
        } catch {
          if (!cancelled) setMissedIsbn(isbn)
        } finally {
          if (!cancelled) setLoadingIsbn(null)
        }
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [isbn, local, context.ready])

  const loadingRemote = Boolean(isbn && loadingIsbn === isbn)

  return {
    book: local,
    ready: context.ready && !loadingRemote,
    missing:
      Boolean(isbn) &&
      context.ready &&
      !loadingRemote &&
      !local &&
      missedIsbn === isbn,
  }
}
