import type { Viewport } from "next"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E7E2DA",
  // Keep form fields visible above the on-screen keyboard on phones.
  interactiveWidget: "resizes-content",
}
