"use client"

import { PageShell } from "@/components/layout/page-shell"
import { AppLink } from "@/components/offline/app-link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function BookNotFound() {
  return (
    <PageShell className="gap-4 py-16">
      <h1 className="text-2xl">Book not found</h1>
      <p className="text-sm text-muted-foreground sm:text-base">
        That ISBN is not in the library, or it has been removed.
      </p>
      <AppLink href="/" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
        Back to library
      </AppLink>
    </PageShell>
  )
}
