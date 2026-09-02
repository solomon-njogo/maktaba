import Image from "next/image"
import { BookOpenIcon } from "lucide-react"

import type { FormattedBookResponse } from "@/types/books"
import { StatusBadge } from "@/components/books/status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export type BookCardData = Pick<
  FormattedBookResponse,
  "Title" | "Author" | "Status"
> &
  Partial<Pick<FormattedBookResponse, "Borrowed" | "BorrowedBy">> & {
    coverUrl?: string
  }

type BookCardProps = {
  book?: BookCardData
  loading?: boolean
  className?: string
}

function Cover({ coverUrl }: { coverUrl?: string }) {
  if (coverUrl) {
    return (
      <Image
        src={coverUrl}
        alt=""
        fill
        sizes="112px"
        className="object-cover"
        unoptimized
      />
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
      <BookOpenIcon />
    </div>
  )
}

function BookCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("w-full", className)} size="sm">
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Skeleton className="aspect-[2/3] w-full max-w-28 shrink-0 rounded-lg sm:w-24" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function BookCard({ book, loading = false, className }: BookCardProps) {
  if (loading || !book) {
    return <BookCardSkeleton className={className} />
  }

  const borrowedLine =
    book.Borrowed === "Yes"
      ? book.BorrowedBy
        ? `With ${book.BorrowedBy}`
        : "Out on loan"
      : null

  return (
    <Card className={cn("w-full", className)} size="sm">
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative aspect-[2/3] w-full max-w-28 shrink-0 overflow-hidden rounded-lg ring-1 ring-foreground/10 sm:w-24">
            <Cover coverUrl={book.coverUrl} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <CardHeader className="px-0">
              <CardTitle>{book.Title}</CardTitle>
              <CardDescription>{book.Author}</CardDescription>
            </CardHeader>
            <StatusBadge status={book.Status} borrowed={book.Borrowed} />
            {borrowedLine ? (
              <p className="text-xs text-muted-foreground">{borrowedLine}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
