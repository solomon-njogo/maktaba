import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FormattedBookResponse } from "@/api/types/books"

export type BookStatus = NonNullable<FormattedBookResponse["Status"]>

const STATUS_LABEL: Record<BookStatus, string> = {
  TBR: "TBR",
  Reading: "Reading",
  Done: "Done",
  "To-Buy": "To-Buy",
}

const STATUS_CLASS: Record<BookStatus, string> = {
  TBR: "bg-status-tbr text-status-tbr-foreground",
  Reading: "bg-status-reading text-status-reading-foreground",
  Done: "bg-status-done text-status-done-foreground",
  "To-Buy": "bg-status-to-buy text-status-to-buy-foreground",
}

type StatusBadgeProps = {
  status: BookStatus
  borrowed?: FormattedBookResponse["Borrowed"]
  className?: string
}

export function StatusBadge({ status, borrowed, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <Badge className={cn("border-transparent", STATUS_CLASS[status])}>
        {STATUS_LABEL[status]}
      </Badge>
      {borrowed === "Yes" ? (
        <Badge className="border-transparent bg-status-borrowed text-status-borrowed-foreground">
          Borrowed
        </Badge>
      ) : null}
    </span>
  )
}
