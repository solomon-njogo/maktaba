import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { AddBookSheet } from "@/components/books/add-book-sheet"
import { LibraryProvider } from "@/components/books/library-provider"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteTabBar } from "@/components/layout/site-tab-bar"
import { ClientOutlet } from "@/components/offline/client-outlet"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SerwistProvider } from "@serwist/turbopack/react"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export { viewport } from "./viewport"

export const metadata: Metadata = {
  title: "Maktaba",
  description:
    "A minimal, high-contrast tracker for a personal physical library.",
  applicationName: "Maktaba",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Maktaba",
  },
}

export const dynamic = "force-dynamic"

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SerwistProvider
          swUrl="/serwist/sw.js"
          options={{ type: "classic" }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
          >
            <TooltipProvider>
              <LibraryProvider>
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                  <ClientOutlet>{children}</ClientOutlet>
                </div>
                <SiteTabBar />
                <AddBookSheet />
                <Toaster
                  theme="light"
                  offset={{ bottom: "6rem" }}
                  mobileOffset={{
                    bottom:
                      "calc(var(--spacing-tab-bar) + var(--spacing-safe-bottom) + 5.25rem)",
                  }}
                />
              </LibraryProvider>
            </TooltipProvider>
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
