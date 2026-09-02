"use client"

import { AppLink } from "@/components/offline/app-link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function BookNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-2xl">Book not found</h1>
      <p className="text-sm text-muted-foreground sm:text-base">
        That ISBN is not in the library, or it has been removed.
      </p>
      <AppLink href="/" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
        Back to library
      </AppLink>
    </div>
  )
}
