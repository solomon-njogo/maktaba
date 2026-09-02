import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import { LibraryProvider } from "@/components/books/library-provider"
import { SiteHeader } from "@/components/layout/site-header"
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

export const metadata: Metadata = {
  title: "Maktaba",
  description:
    "A minimal, high-contrast tracker for a personal physical library.",
  applicationName: "Maktaba",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Maktaba",
  },
}

export const dynamic = "force-dynamic"

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SerwistProvider swUrl="/serwist/sw.js">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
          >
            <TooltipProvider>
              <LibraryProvider>
                <SiteHeader />
                <div className="flex flex-1 flex-col">{children}</div>
                <Toaster />
              </LibraryProvider>
            </TooltipProvider>
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  )
}
