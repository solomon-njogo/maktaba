"use client"

import { AppLink } from "@/components/offline/app-link"
import { libraryShelfForPath, libraryShelves } from "@/lib/shelf"
import { cn } from "@/lib/utils"

export function LibraryShelfFilters({ pathname }: { pathname: string }) {
  const active = libraryShelfForPath(pathname)

  return (
    <nav aria-label="Library shelves" className="-mx-1">
      <ul className="flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {libraryShelves.map((shelf) => {
          const isActive = active === shelf.href
          return (
            <li key={shelf.href} className="shrink-0">
              <AppLink
                href={shelf.href}
                className={cn(
                  "inline-flex min-h-touch items-center rounded-lg px-3 text-sm font-medium transition-colors md:min-h-8",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {shelf.label}
              </AppLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
