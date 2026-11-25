"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(min-width: 768px)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
  // Mobile-first: assume a narrow viewport until the client measures.
  return false
}

export function useMdUp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
