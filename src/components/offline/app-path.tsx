"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { getAppPath, subscribeAppPath } from "@/lib/offline/navigation"

export function useAppPath() {
  const nextPath = usePathname()
  const [path, setPath] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setPath(getAppPath())
    sync()
    return subscribeAppPath(sync)
  }, [nextPath])

  return path
}
