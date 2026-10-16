import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function PageShell({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-page flex-col gap-6 px-page-x py-8",
        className,
        "pb-[calc(var(--spacing-tab-bar)+var(--spacing-safe-bottom)+5rem)] md:pb-24"
      )}
      {...props}
    />
  )
}
