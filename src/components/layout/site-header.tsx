"use client"

import Link from "next/link"

import { AddBookSheet } from "@/components/books/add-book-sheet"
import { AppLink } from "@/components/offline/app-link"
import { useAppPath } from "@/components/offline/app-path"
import { SyncStatusBadge } from "@/components/offline/sync-status"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "Library" },
  { href: "/tbr", label: "TBR" },
  { href: "/reading", label: "Reading" },
  { href: "/done", label: "Done" },
  { href: "/to-buy", label: "To-Buy" },
  { href: "/borrowed", label: "Borrowed" },
] as const

export function SiteHeader() {
  const pathname = useAppPath() ?? ""

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <AppLink href="/" className="font-heading text-lg tracking-tight">
              Maktaba
            </AppLink>
            <p className="truncate text-xs text-muted-foreground">
              Personal library tracker
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SyncStatusBadge />
            <Link
              href="/design-system"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden sm:inline-flex"
              )}
            >
              Design system
            </Link>
            <AddBookSheet />
          </div>
        </div>
        <nav className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <AppLink
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: active ? "secondary" : "ghost",
                    size: "sm",
                  }),
                  "shrink-0"
                )}
              >
                {item.label}
              </AppLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
