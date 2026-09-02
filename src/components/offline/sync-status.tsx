"use client"

import { useLibraryStatus } from "@/components/books/library-provider"
import { cn } from "@/lib/utils"

export function SyncStatusBadge() {
  const status = useLibraryStatus()

  if (!status.online) {
    return (
      <span
        className={cn(
          "rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
        )}
      >
        Offline
      </span>
    )
  }

  if (status.pendingCount > 0) {
    return (
      <span
        className={cn(
          "rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
        )}
      >
        {status.syncing ? "Syncing" : `Pending ${status.pendingCount}`}
      </span>
    )
  }

  if (status.syncing) {
    return (
      <span
        className={cn(
          "rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
        )}
      >
        Syncing
      </span>
    )
  }

  return null
}
