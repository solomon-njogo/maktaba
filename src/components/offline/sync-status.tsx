"use client"

import { useLibraryStatus } from "@/components/books/library-provider"
import { AppLink } from "@/components/offline/app-link"
import { useAppPath } from "@/components/offline/app-path"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const badgeClass =
  "h-auto min-h-8 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase"

export function SyncStatusBadge() {
  const status = useLibraryStatus()
  const path = useAppPath()
  const onQueue = path === "/pending"

  if (!status.online) {
    return (
      <Badge variant="outline" className={badgeClass}>
        Offline
      </Badge>
    )
  }

  if (status.pendingCount > 0) {
    return (
      <Badge
        variant="outline"
        className={cn(badgeClass, onQueue && "bg-muted")}
        render={<AppLink href="/pending" aria-label="View pending sync queue" />}
      >
        {status.syncing ? "Syncing" : `Pending ${status.pendingCount}`}
      </Badge>
    )
  }

  if (status.syncing) {
    return (
      <Badge variant="outline" className={badgeClass}>
        Syncing
      </Badge>
    )
  }

  return null
}
