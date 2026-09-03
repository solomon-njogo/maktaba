export const DESKTOP_NAV = [
  { href: "/", label: "Library" },
  { href: "/tbr", label: "TBR" },
  { href: "/reading", label: "Reading" },
  { href: "/done", label: "Done" },
  { href: "/to-buy", label: "To-Buy" },
  { href: "/borrowed", label: "Borrowed" },
] as const

export const PHONE_TABS = [
  { href: "/", label: "Library" },
  { href: "/tbr", label: "TBR" },
  { href: "/reading", label: "Reading" },
  { href: "/done", label: "Done" },
] as const

export const MORE_NAV = [
  { href: "/to-buy", label: "To-Buy", mode: "app" },
  { href: "/borrowed", label: "Borrowed", mode: "app" },
  { href: "/design-system", label: "Design system", mode: "next" },
] as const

export function isMorePath(pathname: string) {
  return MORE_NAV.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  )
}
