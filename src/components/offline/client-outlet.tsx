"use client"

import type { ReactNode } from "react"

import { BookDetail } from "@/components/books/book-detail"
import { BookNotFound } from "@/components/books/book-not-found"
import { LibraryView } from "@/components/books/library-view"
import { useBook } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import { AppLink } from "@/components/offline/app-link"
import { useAppPath } from "@/components/offline/app-path"
import { PendingQueueView } from "@/components/offline/pending-queue"
import { buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cleanIsbnString } from "@/lib/isbn"
import { bookIsbnFromPath, isDesignSystemPath } from "@/lib/offline/navigation"
import { cn } from "@/lib/utils"

const LIST_PATHS = new Set([
  "/",
  "/tbr",
  "/reading",
  "/done",
  "/to-buy",
  "/borrowed",
  "/pending",
  "/~offline",
])

function BookRoute({ isbn }: { isbn: string }) {
  const { book, ready, missing } = useBook(isbn)

  if (!ready) {
    return (
      <PageShell className="flex-row items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner />
        Opening book…
      </PageShell>
    )
  }

  if (missing || !book) {
    return <BookNotFound />
  }

  return <BookDetail book={book} />
}

function RouteView({ path }: { path: string }) {
  const isbn = bookIsbnFromPath(path)

  if (isbn) {
    return <BookRoute isbn={cleanIsbnString(isbn) || isbn} />
  }

  if (!LIST_PATHS.has(path)) {
    return (
      <PageShell className="gap-4 py-16">
        <h1 className="text-2xl">Page not found</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          That screen is not part of the library.
        </p>
        <AppLink href="/" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
          Back to library
        </AppLink>
      </PageShell>
    )
  }

  if (path === "/tbr") {
    return (
      <LibraryView
        title="TBR"
        description="What is next in the reading pipeline."
        filters={{ status: "TBR" }}
        emptyVariant="tbr"
      />
    )
  }

  if (path === "/reading") {
    return (
      <LibraryView
        title="Reading"
        description="Titles currently in progress."
        filters={{ status: "Reading" }}
        emptyVariant="reading"
      />
    )
  }

  if (path === "/done") {
    return (
      <LibraryView
        title="Done"
        description="Finished books and reading history."
        filters={{ status: "Done" }}
        emptyVariant="done"
      />
    )
  }

  if (path === "/to-buy") {
    return (
      <LibraryView
        title="To-Buy"
        description="Titles planned for purchase."
        filters={{ status: "To-Buy" }}
        emptyVariant="to-buy"
      />
    )
  }

  if (path === "/borrowed") {
    return (
      <LibraryView
        title="Borrowed"
        description="Books that are out on loan."
        filters={{ borrowed: "Yes" }}
        emptyVariant="borrowed"
      />
    )
  }

  if (path === "/pending") {
    return <PendingQueueView />
  }

  return (
    <LibraryView
      title="Library"
      description="Every title currently on the shelves."
      emptyVariant="library"
    />
  )
}

export function ClientOutlet({ children }: { children: ReactNode }) {
  const path = useAppPath()

  if (path === null) {
    return (
      <PageShell className="flex-row items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner />
        Loading library…
      </PageShell>
    )
  }

  if (isDesignSystemPath(path)) {
    return children
  }

  return <RouteView path={path} />
}
