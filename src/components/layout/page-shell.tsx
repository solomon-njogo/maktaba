"use client"

import type { ComponentProps } from "react"

import { useAppPath } from "@/components/offline/app-path"
import { showsPhoneBar } from "@/lib/shelf"
import { cn } from "@/lib/utils"

export function PageShell({ className, ...props }: ComponentProps<"div">) {
  const path = useAppPath()
  const phoneBar = path !== null && showsPhoneBar(path)

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-page flex-col gap-6 px-page-x py-8",
        phoneBar
          ? "pb-[calc(var(--spacing-tab-bar)+var(--spacing-safe-bottom)+5rem)] md:pb-24"
          : "pb-[max(2rem,var(--spacing-safe-bottom))] md:pb-24",
        className
      )}
      {...props}
    />
  )
}
