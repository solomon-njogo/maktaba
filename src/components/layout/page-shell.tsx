import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

export function PageShell({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-page flex-col gap-6 px-page-x py-8 pb-[calc(var(--spacing-tab-bar)+var(--spacing-safe-bottom))] md:pb-8",
        className
      )}
      {...props}
    />
  )
}
