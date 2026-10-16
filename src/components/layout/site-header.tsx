"use client"

import Link from "next/link"

import { AppLink } from "@/components/offline/app-link"
import { useAppPath } from "@/components/offline/app-path"
import { SyncStatusBadge } from "@/components/offline/sync-status"
import { buttonVariants } from "@/components/ui/button"
import { destinations, screenForPath } from "@/lib/shelf"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const pathname = useAppPath()
  const screen = pathname ? screenForPath(pathname) : null

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 pt-[max(0.75rem,var(--spacing-safe-top))] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-page flex-col gap-3 px-page-x py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <AppLink href="/" className="font-heading text-lg tracking-tight">
              Maktaba
            </AppLink>
            <p className="hidden truncate text-xs text-muted-foreground md:block">
              Personal library tracker
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SyncStatusBadge />
            <Link
              href="/design-system"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden md:inline-flex"
              )}
            >
              Design system
            </Link>
          </div>
        </div>
        <nav className="-mx-1 hidden gap-1 md:flex" aria-label="Primary">
          {destinations.map((item) => {
            const active = screen !== null && screen === screenForPath(item.href)
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
                aria-current={active ? "page" : undefined}
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
