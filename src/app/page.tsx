import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-lg flex-col gap-6">
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Personal library
        </p>
        <h1 className="text-4xl sm:text-5xl">Maktaba</h1>
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          A high-contrast tracker for owned books, reading history, the TBR
          queue, and titles still to buy.
        </p>
        <Button
          render={<Link href="/design-system" />}
          nativeButton={false}
          className="w-fit"
        >
          Open design system
        </Button>
      </main>
    </div>
  )
}
