"use client"

import type { ComponentProps } from "react"

import { navigateApp } from "@/lib/offline/navigation"

type AppLinkProps = ComponentProps<"a"> & {
  href: string
}

export function AppLink({ href, onClick, children, ...props }: AppLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        if (event.button !== 0) return
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigateApp(href)
      }}
      {...props}
    >
      {children}
    </a>
  )
}
