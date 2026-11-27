import type { BookCreatePayload, FormattedBookResponse } from "@/types/books"

export type LocalBook = FormattedBookResponse & {
  pending?: boolean
  deleted?: boolean
}

export type { BookCreatePayload }

export type OutboxOpType = "create" | "update" | "delete"

export type OutboxOp = {
  id: string
  type: OutboxOpType
  isbn: string
  payload?: BookCreatePayload
  createdAt: number
  queuedAt?: number
  attempts?: number
  lastAttemptAt?: number
  lastError?: string
  lastStatus?: number
  nextRetryAt?: number
  paused?: boolean
}

export type SyncStatus = {
  online: boolean
  syncing: boolean
  pendingCount: number
  pausedCount?: number
  lastSyncedAt?: number
  lastError?: string
}
