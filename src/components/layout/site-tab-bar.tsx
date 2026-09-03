"use client"

import { useState } from "react"
import Link from "next/link"
import {
  BookmarkIcon,
  BookOpenIcon,
  CheckIcon,
  EllipsisIcon,
  LibraryIcon,
} from "lucide-react"

import { isMorePath, MORE_NAV, PHONE_TABS } from "@/components/layout/nav"
import { AppLink } from "@/components/offline/app-link"
import { useAppPath } from "@/components/offline/app-path"
import { buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const TAB_ICONS = {
  "/": LibraryIcon,
  "/tbr": BookmarkIcon,
  "/reading": BookOpenIcon,
  "/done": CheckIcon,
} as const

export function SiteTabBar() {
  const pathname = useAppPath() ?? ""
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = isMorePath(pathname)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[max(0.25rem,var(--spacing-safe-bottom))] backdrop-blur-sm md:hidden"
        aria-label="Primary"
      >
        <ul className="mx-auto grid max-w-page grid-cols-5 px-1 pt-1">
          {PHONE_TABS.map((item) => {
            const Icon = TAB_ICONS[item.href]
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <AppLink
                  href={item.href}
                  className={cn(
                    "flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" />
                  {item.label}
                </AppLink>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex min-h-touch w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium",
                moreActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <EllipsisIcon className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Lists and internals.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-[max(1rem,var(--spacing-safe-bottom))]">
            {MORE_NAV.map((item) => {
              const active = pathname === item.href
              const className = cn(
                buttonVariants({
                  variant: active ? "secondary" : "ghost",
                }),
                "h-touch w-full justify-start"
              )
              if (item.mode === "next") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={className}
                  >
                    {item.label}
                  </Link>
                )
              }
              return (
                <AppLink
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={className}
                >
                  {item.label}
                </AppLink>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
