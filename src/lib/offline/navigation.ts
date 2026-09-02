const EVENT = "maktaba:navigate"

export function getAppPath() {
  return typeof window === "undefined" ? "/" : window.location.pathname
}

export function isDesignSystemPath(pathname: string) {
  return pathname === "/design-system" || pathname.startsWith("/design-system/")
}

export function bookIsbnFromPath(pathname: string) {
  const match = pathname.match(/^\/books\/([^/]+)\/?$/)
  if (!match) return undefined
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function navigateApp(href: string) {
  const url = new URL(href, window.location.origin)
  if (url.origin !== window.location.origin) {
    window.location.assign(href)
    return
  }

  const next = `${url.pathname}${url.search}${url.hash}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (next !== current) {
    window.history.pushState({}, "", next)
  }
  window.dispatchEvent(new Event(EVENT))
}

export function subscribeAppPath(listener: () => void) {
  const onChange = () => listener()
  window.addEventListener("popstate", onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(EVENT, onChange)
  }
}
