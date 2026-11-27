"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { getBook } from "@/lib/api/books"
import { getAllBooks, getLastSyncedAt, getOutbox } from "@/lib/offline/db"
import { subscribeLibrary } from "@/lib/offline/events"
import { filterBooks } from "@/lib/offline/books-repository"
import { buildSyncSnapshot, startOfflineSync } from "@/lib/offline/sync"
import type { LocalBook, OutboxOp, SyncStatus } from "@/lib/offline/types"
import type { ListBooksFilters } from "@/lib/api/books"

type LibraryContextValue = {
  books: LocalBook[]
  outbox: OutboxOp[]
  ready: boolean
  status: SyncStatus
  booksFor: (filters?: ListBooksFilters) => LocalBook[]
  bookByIsbn: (isbn: string) => LocalBook | undefined
  anyBookByIsbn: (isbn: string) => LocalBook | undefined
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

const idleStatus: SyncStatus = {
  online: true,
  syncing: false,
  pendingCount: 0,
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [books, setBooks] = useState<LocalBook[]>([])
  const [outbox, setOutbox] = useState<OutboxOp[]>([])
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<SyncStatus>(idleStatus)
  const refreshSeqRef = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++refreshSeqRef.current
    try {
      const [all, ops, lastSyncedAt] = await Promise.all([
        getAllBooks(),
        getOutbox(),
        getLastSyncedAt(),
      ])
      if (seq !== refreshSeqRef.current) return
      setBooks(all)
      setOutbox(ops)
      setStatus(buildSyncSnapshot(ops, lastSyncedAt))
    } catch {
      if (seq !== refreshSeqRef.current) return
      setStatus((current) => ({
        ...current,
        online: typeof navigator === "undefined" ? true : navigator.onLine,
      }))
    } finally {
      if (seq === refreshSeqRef.current) {
        setReady(true)
      }
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
      outbox,
      ready,
      status,
      booksFor: (filters) => filterBooks(books, filters),
      bookByIsbn: (isbn) =>
        books.find((book) => book.ISBN === isbn && !book.deleted),
      anyBookByIsbn: (isbn) => books.find((book) => book.ISBN === isbn),
    }),
    [books, outbox, ready, status]
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

export function usePendingQueue() {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error("usePendingQueue must be used within LibraryProvider")
  }

  return {
    ops: context.outbox,
    ready: context.ready,
    status: context.status,
    bookFor: (isbn: string) =>
      context.books.find((book) => book.ISBN === isbn),
  }
}

export function useBook(isbn: string | undefined) {
  const context = useContext(LibraryContext)
  if (!context) {
    throw new Error("useBook must be used within LibraryProvider")
  }

  const local = isbn ? context.bookByIsbn(isbn) : undefined
  const anyLocal = isbn ? context.anyBookByIsbn(isbn) : undefined
  const [missedIsbn, setMissedIsbn] = useState<string | null>(null)
  const [loadingIsbn, setLoadingIsbn] = useState<string | null>(null)

  useEffect(() => {
    if (!isbn || anyLocal || !context.ready) return

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
  }, [isbn, anyLocal, context.ready])

  const loadingRemote = Boolean(isbn && loadingIsbn === isbn)

  return {
    book: local,
    ready: context.ready && !loadingRemote,
    missing:
      Boolean(isbn) &&
      context.ready &&
      !loadingRemote &&
      !local &&
      (missedIsbn === isbn || Boolean(anyLocal?.deleted)),
  }
}
