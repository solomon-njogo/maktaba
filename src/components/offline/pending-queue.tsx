"use client"

import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloudOffIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { usePendingQueue } from "@/components/books/library-provider"
import { PageShell } from "@/components/layout/page-shell"
import { AppLink } from "@/components/offline/app-link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  clearQueuedOps,
  dropQueuedOp,
  moveQueuedOp,
} from "@/lib/offline/books-repository"
import { retryOutboxNow } from "@/lib/offline/sync"
import type { BookCreatePayload, OutboxOp, OutboxOpType } from "@/lib/offline/types"
import { cn } from "@/lib/utils"

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

function formatTimestamp(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatTimeOnly(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, {
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

function QueueItem({
  op,
  title,
  author,
  index,
  total,
  busy,
  onMove,
  onRetry,
  onDrop,
}: {
  op: OutboxOp
  title?: string
  author?: string
  index: number
  total: number
  busy: boolean
  onMove: (id: string, direction: -1 | 1) => void
  onRetry: (id: string) => void
  onDrop: (id: string) => void
}) {
  const summary = payloadSummary(op.payload)
  const heading = title || op.isbn
  const href =
    op.type === "delete" ? null : `/books/${encodeURIComponent(op.isbn)}`
  const needsTitle =
    Boolean(op.paused) &&
    op.type === "create" &&
    !op.payload?.Title?.trim()

  return (
    <li>
      <Card size="sm">
        <CardHeader>
          {href ? (
            <CardTitle className="min-w-0">
              <AppLink
                href={href}
                className="wrap-break-word rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {heading}
              </AppLink>
            </CardTitle>
          ) : (
            <CardTitle className="min-w-0 wrap-break-word">{heading}</CardTitle>
          )}
          <CardDescription>{author || "Unknown author"}</CardDescription>
          <CardAction className="flex flex-wrap items-center justify-end gap-1.5">
            {op.paused ? (
              <Badge variant="destructive">Needs attention</Badge>
            ) : null}
            <Badge variant="outline">{OP_LABEL[op.type]}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>ISBN {op.isbn}</p>
          <p>Queued {formatTimestamp(op.queuedAt ?? op.createdAt)}</p>
          {summary ? <p>{summary}</p> : null}
          {!op.paused && (op.attempts ?? 0) > 0 ? (
            <p>
              Attempts: {op.attempts}
              {op.nextRetryAt
                ? ` · Next retry ${formatTimeOnly(op.nextRetryAt)}`
                : ""}
            </p>
          ) : null}
          {op.lastError ? (
            <p className="text-destructive">{op.lastError}</p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="min-h-touch min-w-touch md:min-h-7 md:min-w-7"
            disabled={busy || index === 0}
            onClick={() => onMove(op.id, -1)}
            aria-label={`Move ${heading} up`}
          >
            <ChevronUpIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="min-h-touch min-w-touch md:min-h-7 md:min-w-7"
            disabled={busy || index === total - 1}
            onClick={() => onMove(op.id, 1)}
            aria-label={`Move ${heading} down`}
          >
            <ChevronDownIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-touch md:min-h-7"
            disabled={busy}
            onClick={() => onRetry(op.id)}
          >
            <RefreshCwIcon data-icon="inline-start" />
            Retry
          </Button>
          {needsTitle ? (
            <AppLink
              href={`/books/${encodeURIComponent(op.isbn)}`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "min-h-touch md:min-h-7"
              )}
            >
              Add title
            </AppLink>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="ms-auto min-h-touch md:min-h-7"
            disabled={busy}
            onClick={() => onDrop(op.id)}
          >
            <Trash2Icon data-icon="inline-start" />
            Drop
          </Button>
        </CardFooter>
      </Card>
    </li>
  )
}

export function PendingQueueView() {
  const { ops, ready, status, bookFor } = usePendingQueue()
  const [busy, setBusy] = useState(false)
  const [syncingNow, setSyncingNow] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const disabled = busy || syncingNow || status.syncing
  const hasOpErrors = ops.some((op) => Boolean(op.lastError))

  async function handleMove(id: string, direction: -1 | 1) {
    setBusy(true)
    try {
      await moveQueuedOp(id, direction)
    } catch {
      toast.error("Could not reorder the queue.")
    } finally {
      setBusy(false)
    }
  }

  async function handleSyncNow() {
    setSyncingNow(true)
    try {
      const result = await retryOutboxNow()
      if (result.retryableRemaining === 0 && result.pausedRemaining === 0) {
        toast.success("Queue synced.")
      } else if (
        result.pausedRemaining > 0 &&
        result.retryableRemaining === 0
      ) {
        toast.error("Some items need attention before syncing.")
      } else {
        toast.error("Could not sync all changes. Will retry.")
      }
    } catch {
      toast.error("Could not sync the queue.")
    } finally {
      setSyncingNow(false)
    }
  }

  async function handleRetryItem(id: string) {
    setBusy(true)
    try {
      const result = await retryOutboxNow(id)
      if (result.retryableRemaining === 0 && result.pausedRemaining === 0) {
        toast.success("Synced change.")
      }
    } catch {
      toast.error("Could not retry that item.")
    } finally {
      setBusy(false)
    }
  }

  async function handleDrop(id: string) {
    setBusy(true)
    try {
      await dropQueuedOp(id)
      toast.success("Dropped from the queue.")
    } catch {
      toast.error("Could not drop that item.")
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    setBusy(true)
    try {
      await clearQueuedOps()
      setClearOpen(false)
      toast.success("Queue cleared.")
    } catch {
      toast.error("Could not clear the queue.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl">Pending</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Local changes waiting to sync
            {ops.length > 0 ? ` · ${ops.length}` : ""}.
          </p>
        </div>
        {ops.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-touch md:min-h-7"
              disabled={disabled}
              onClick={() => void handleSyncNow()}
            >
              {syncingNow || status.syncing ? (
                <>
                  <Spinner />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCwIcon data-icon="inline-start" />
                  Sync now
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit min-h-touch md:min-h-7"
              disabled={disabled}
              onClick={() => setClearOpen(true)}
            >
              Clear queue
            </Button>
          </div>
        ) : null}
      </header>
      {status.lastError && !hasOpErrors ? (
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
        <ul className="flex flex-col gap-3">
          {ops.map((op, index) => {
            const book = bookFor(op.isbn)
            return (
              <QueueItem
                key={op.id}
                op={op}
                title={book?.Title}
                author={book?.Author}
                index={index}
                total={ops.length}
                busy={disabled}
                onMove={handleMove}
                onRetry={(id) => void handleRetryItem(id)}
                onDrop={handleDrop}
              />
            )
          })}
        </ul>
      )}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the pending queue?</AlertDialogTitle>
            <AlertDialogDescription>
              These changes will not sync. Unsynced new titles are removed from
              this device. Other books keep their last saved library state after
              the next sync.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={handleClear}
            >
              Clear queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
