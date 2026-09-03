"use client"

import { CloudOffIcon } from "lucide-react"

import { usePendingQueue } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import { AppLink } from "@/components/offline/app-link"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { BookCreatePayload, OutboxOp, OutboxOpType } from "@/lib/offline/types"

const OP_LABEL: Record<OutboxOpType, string> = {
  create: "Add",
  update: "Update",
  delete: "Remove",
}

const FIELD_LABEL: Record<keyof BookCreatePayload, string> = {
  Title: "Title",
  Author: "Author",
  Genre: "Genre",
  Status: "Status",
  StartDate: "Started",
  EndDate: "Finished",
  Borrowed: "Borrowed",
  BorrowedBy: "Borrowed by",
  BorrowedOn: "Borrowed on",
  BorrowedUntil: "Borrowed until",
}

function queuedAt(value: number) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function payloadSummary(payload?: BookCreatePayload) {
  if (!payload) return null
  const parts = (Object.keys(payload) as Array<keyof BookCreatePayload>)
    .filter((key) => payload[key] !== undefined && payload[key] !== "")
    .map((key) => `${FIELD_LABEL[key]}: ${payload[key]}`)
  return parts.length > 0 ? parts.join(" · ") : null
}

function QueueEmpty() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudOffIcon />
        </EmptyMedia>
        <EmptyTitle>Nothing waiting to sync</EmptyTitle>
        <EmptyDescription>
          Changes you make offline show up here until they reach the library.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function QueueCard({
  op,
  title,
  author,
  interactive,
}: {
  op: OutboxOp
  title?: string
  author?: string
  interactive: boolean
}) {
  const summary = payloadSummary(op.payload)
  const heading = title || op.isbn

  return (
    <Card
      size="sm"
      className={interactive ? "transition-colors hover:bg-muted/40" : undefined}
    >
      <CardHeader>
        <CardTitle className="min-w-0 wrap-break-word">{heading}</CardTitle>
        <CardDescription>{author || "Unknown author"}</CardDescription>
        <CardAction>
          <Badge variant="outline">{OP_LABEL[op.type]}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
        <p>ISBN {op.isbn}</p>
        <p>Queued {queuedAt(op.createdAt)}</p>
        {summary ? <p>{summary}</p> : null}
      </CardContent>
    </Card>
  )
}

function QueueItem({
  op,
  title,
  author,
  linkable,
}: {
  op: OutboxOp
  title?: string
  author?: string
  linkable: boolean
}) {
  const card = (
    <QueueCard op={op} title={title} author={author} interactive={linkable} />
  )

  return (
    <li>
      {linkable ? (
        <AppLink
          href={`/books/${encodeURIComponent(op.isbn)}`}
          className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {card}
        </AppLink>
      ) : (
        card
      )}
    </li>
  )
}

export function PendingQueueView() {
  const { ops, ready, status, bookFor } = usePendingQueue()

  return (
    <PageShell>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl sm:text-3xl">Pending</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Local changes waiting to sync
          {ops.length > 0 ? ` · ${ops.length}` : ""}.
        </p>
      </header>
      {status.lastError ? (
        <p className="text-sm text-destructive">{status.lastError}</p>
      ) : null}
      {!ready ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Loading queue…
        </div>
      ) : ops.length === 0 ? (
        <QueueEmpty />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ops.map((op) => {
            const book = bookFor(op.isbn)
            return (
              <QueueItem
                key={op.id}
                op={op}
                title={book?.Title}
                author={book?.Author}
                linkable={Boolean(book && !book.deleted)}
              />
            )
          })}
        </ul>
      )}
    </PageShell>
  )
}
