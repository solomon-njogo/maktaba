"use client"

import {
  BookOpenIcon,
  BookmarkIcon,
  SearchIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "lucide-react"

import { AppLink } from "@/components/offline/app-link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

export type BookEmptyVariant =
  | "library"
  | "tbr"
  | "reading"
  | "done"
  | "to-buy"
  | "borrowed"
  | "search"

type EmptyAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "button"; label: string; onClick: () => void }

const COPY: Record<
  BookEmptyVariant,
  {
    title: string
    description: string
    icon: typeof BookOpenIcon
    action?: EmptyAction
  }
> = {
  library: {
    title: "No books on the shelf",
    description: "Add a title by ISBN to start the inventory.",
    icon: BookOpenIcon,
    action: { kind: "link", href: "/add", label: "Add a book" },
  },
  tbr: {
    title: "The TBR queue is empty",
    description: "Tag owned titles as TBR when they are next in the pipeline.",
    icon: BookmarkIcon,
    action: { kind: "link", href: "/library", label: "Browse library" },
  },
  reading: {
    title: "Nothing in progress",
    description: "Start a TBR title, or mark one as Reading from the library.",
    icon: BookOpenIcon,
    action: { kind: "link", href: "/tbr", label: "Open TBR" },
  },
  done: {
    title: "No finished titles yet",
    description: "Mark books Done when you close the last page.",
    icon: BookmarkIcon,
    action: { kind: "link", href: "/library", label: "Browse library" },
  },
  "to-buy": {
    title: "Nothing on the acquisition list",
    description: "Save titles you plan to purchase so they do not get lost.",
    icon: ShoppingBagIcon,
    action: { kind: "link", href: "/add", label: "Add a title" },
  },
  borrowed: {
    title: "Nothing is out on loan",
    description: "When a book leaves the house, mark it as borrowed from its page.",
    icon: UsersIcon,
    action: { kind: "link", href: "/library", label: "Browse library" },
  },
  search: {
    title: "No matching titles",
    description: "Try a different title, author, ISBN, or genre.",
    icon: SearchIcon,
  },
}

type BookEmptyProps = {
  variant?: BookEmptyVariant
  /** Overrides the default action (e.g. clear search). */
  action?: EmptyAction | null
}

export function BookEmpty({ variant = "library", action }: BookEmptyProps) {
  const copy = COPY[variant]
  const resolved = action === undefined ? copy.action : action ?? undefined
  const Icon = copy.icon

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{copy.title}</EmptyTitle>
        <EmptyDescription>{copy.description}</EmptyDescription>
      </EmptyHeader>
      {resolved ? (
        <EmptyContent>
          {resolved.kind === "link" ? (
            <AppLink
              href={resolved.href}
              className={cn(buttonVariants({ size: "sm" }), "min-h-touch md:min-h-8")}
            >
              {resolved.label}
            </AppLink>
          ) : (
            <Button
              type="button"
              size="sm"
              className="min-h-touch md:min-h-8"
              onClick={resolved.onClick}
            >
              {resolved.label}
            </Button>
          )}
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
