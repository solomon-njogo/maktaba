"use client"

import { useState } from "react"
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "lucide-react"

import {
  moveBookStatus,
  type MovableBook,
} from "@/components/books/move-book-status"
import {
  STATUS_CLASS,
  STATUS_LABEL,
  StatusBadge,
} from "@/components/books/status-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useMdUp } from "@/hooks/use-md-up"
import { BOOK_STATUSES, STATUS_META, nextStatusAction } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { BookStatus } from "@/types/books"

export function QuickStatusPicker({
  book,
  disabled,
  className,
}: {
  book: MovableBook
  disabled?: boolean
  className?: string
}) {
  const mdUp = useMdUp()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const nextStatus = nextStatusAction(book.Status)?.status

  async function selectStatus(status: BookStatus) {
    if (status === book.Status) {
      setOpen(false)
      return
    }
    setPending(true)
    try {
      const moved = await moveBookStatus(book, status)
      if (moved) setOpen(false)
    } finally {
      setPending(false)
    }
  }

  const isDisabled = Boolean(disabled || pending || !book.ISBN)
  const triggerElement = (
    <button
      type="button"
      disabled={isDisabled}
      aria-label={`Status: ${book.Status}. Change status for ${book.Title}`}
      className={cn(
        "inline-flex min-h-touch items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all outline-none select-none ring-1 ring-inset ring-foreground/10 hover:brightness-95 active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:h-8 md:min-h-8 md:px-3",
        STATUS_CLASS[book.Status],
        className
      )}
    />
  )

  const triggerLabel = (
    <>
      <span>{STATUS_LABEL[book.Status]}</span>
      <ChevronDownIcon className="size-3.5 opacity-70" aria-hidden />
    </>
  )

  if (!mdUp) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={triggerElement}>{triggerLabel}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="w-full rounded-t-2xl data-[side=bottom]:max-h-[85dvh]"
        >
          <div
            className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border"
            aria-hidden
          />
          <SheetHeader className="pt-2 pb-1">
            <SheetTitle className="line-clamp-1 pr-8">{book.Title}</SheetTitle>
            <SheetDescription>
              {book.Author ? `${book.Author} · Move status` : "Choose a status"}
            </SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-2 px-4 pb-4">
            {BOOK_STATUSES.map((status) => {
              const active = status === book.Status
              const isNext = nextStatus === status
              return (
                <li key={status}>
                  <button
                    type="button"
                    disabled={pending}
                    aria-current={active ? "true" : undefined}
                    onClick={() => void selectStatus(status)}
                    className={cn(
                      "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                      active
                        ? "bg-muted/70 ring-2 ring-foreground/20"
                        : "bg-card ring-1 ring-foreground/10 hover:bg-muted/50 active:scale-[0.99]"
                    )}
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <StatusBadge status={status} />
                      <span className="text-xs text-muted-foreground">
                        {STATUS_META[status].description}
                      </span>
                    </span>
                    {active ? (
                      <CheckIcon
                        className="size-4 shrink-0 text-foreground"
                        aria-hidden
                      />
                    ) : isNext ? (
                      <ArrowRightIcon
                        className="size-4 shrink-0 text-muted-foreground/60"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={triggerElement}>
        {triggerLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {BOOK_STATUSES.map((status) => (
            <DropdownMenuItem
              key={status}
              disabled={pending}
              onClick={() => void selectStatus(status)}
              className="justify-between gap-2 py-1.5"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full ring-1 ring-foreground/15",
                    STATUS_CLASS[status]
                  )}
                  aria-hidden
                />
                <span>{STATUS_META[status].label}</span>
              </span>
              {status === book.Status ? (
                <CheckIcon className="size-4 text-foreground" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StatusPipelineBar({
  book,
  disabled,
  className,
}: {
  book: MovableBook
  disabled?: boolean
  className?: string
}) {
  const [pending, setPending] = useState(false)

  async function selectStatus(status: BookStatus) {
    if (pending || !book.ISBN || status === book.Status) return
    setPending(true)
    try {
      await moveBookStatus(book, status)
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="group"
      aria-label="Status"
      className={cn(
        "grid w-full max-w-md grid-cols-4 gap-1 rounded-2xl bg-card/80 p-1 shadow-xs ring-1 ring-foreground/10 backdrop-blur-xl",
        className
      )}
    >
      {BOOK_STATUSES.map((status) => {
        const active = status === book.Status
        return (
          <button
            key={status}
            type="button"
            disabled={!book.ISBN || disabled || pending}
            aria-pressed={active}
            onClick={() => void selectStatus(status)}
            className={cn(
              "flex min-h-touch items-center justify-center rounded-xl px-1.5 text-xs font-medium transition-all outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:min-h-9 md:text-sm",
              active
                ? cn(
                    STATUS_CLASS[status],
                    "font-semibold shadow-xs ring-1 ring-foreground/10"
                  )
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]"
            )}
          >
            {STATUS_LABEL[status]}
          </button>
        )
      })}
    </div>
  )
}
