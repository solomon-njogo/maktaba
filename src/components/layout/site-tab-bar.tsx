"use client"

import { HouseIcon, LibraryIcon, PlusIcon } from "lucide-react"

import { AppLink } from "@/components/offline/app-link"
import { useAppPath } from "@/components/offline/app-path"
import { destinations, screenForPath, showsPhoneBar } from "@/lib/shelf"
import { cn } from "@/lib/utils"

const TAB_ICONS = {
  "/": HouseIcon,
  "/add": PlusIcon,
  "/library": LibraryIcon,
} as const

export function SiteTabBar() {
  const pathname = useAppPath()
  if (!pathname || !showsPhoneBar(pathname)) return null

  const screen = screenForPath(pathname)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 pb-[max(0.25rem,var(--spacing-safe-bottom))] backdrop-blur-sm md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-page grid-cols-3 px-1 pt-1">
        {destinations.map((item) => {
          const Icon = TAB_ICONS[item.href]
          const active = screen === screenForPath(item.href)
          return (
            <li key={item.href}>
              <AppLink
                href={item.href}
                className={cn(
                  "flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground active:bg-muted/60"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn("size-5", active && "stroke-[2.25px]")}
                  aria-hidden
                />
                {item.label}
              </AppLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
