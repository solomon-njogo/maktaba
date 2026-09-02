"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { BookCard } from "@/components/books/book-card"
import { BookEmpty } from "@/components/books/book-empty"
import { StatusBadge } from "@/components/books/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Swatch({
  name,
  className,
}: {
  name: string
  className: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div
        className={`h-16 w-full rounded-lg ring-1 ring-foreground/10 ${className}`}
      />
      <p className="truncate font-mono text-xs text-muted-foreground">{name}</p>
    </div>
  )
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Maktaba
        </p>
        <h1 className="text-3xl sm:text-4xl">Design system</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Dark-first tokens, shadcn primitives, and library composites. Prefer
          semantic utilities over raw color values.
        </p>
        <Button
          render={<Link href="/" />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          Back home
        </Button>
      </header>

      <Separator />

      <Section title="Color" description="Canvas, elevated surfaces, and status chips.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          <Swatch name="background" className="bg-background" />
          <Swatch name="surface / card" className="bg-card" />
          <Swatch name="primary" className="bg-primary" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="muted" className="bg-muted" />
          <Swatch name="status-tbr" className="bg-status-tbr" />
          <Swatch name="status-reading" className="bg-status-reading" />
          <Swatch name="status-done" className="bg-status-done" />
          <Swatch name="status-to-buy" className="bg-status-to-buy" />
          <Swatch name="status-borrowed" className="bg-status-borrowed" />
        </div>
      </Section>

      <Section title="Type" description="Inter for interface copy. Geist Mono for headings.">
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <h1 className="text-3xl">Heading 1 — Geist Mono</h1>
          <h2 className="text-2xl">Heading 2 — Geist Mono</h2>
          <p className="max-w-xl text-base leading-relaxed">
            Body copy in Inter. Use muted-foreground for supporting lines and
            keep line length readable on small screens.
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            ISBN 978-0-00-000000-0
          </p>
        </div>
      </Section>

      <Section title="Primitives">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm text-muted-foreground">Button</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button>
                <SearchIcon data-icon="inline-start" />
                Search ISBN
              </Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Remove</Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm text-muted-foreground">Badge</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm text-muted-foreground">Field</h3>
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Manual ISBN</CardTitle>
                <CardDescription>
                  Lookup uses the same field layout as product forms.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="isbn">ISBN</FieldLabel>
                    <Input id="isbn" placeholder="978…" />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm text-muted-foreground">Dialog</h3>
            <Dialog>
              <DialogTrigger render={<Button variant="outline" />}>
                Confirm remove
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove this title?</DialogTitle>
                  <DialogDescription>
                    Soft-deleted books stay hidden for 30 days, then are removed
                    permanently.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive">Remove</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm text-muted-foreground">Toast</h3>
            <Button
              variant="secondary"
              onClick={() => toast.success("Book added to TBR")}
            >
              Show toast
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm text-muted-foreground">Empty + Skeleton</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>Generic empty</EmptyTitle>
                  <EmptyDescription>
                    Product screens should prefer BookEmpty instead of this
                    primitive directly.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              <div className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Product" description="Composites for inventory, pipeline, and loans.">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="TBR" />
            <StatusBadge status="Reading" />
            <StatusBadge status="Done" />
            <StatusBadge status="To-Buy" />
            <StatusBadge status="Reading" borrowed="Yes" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BookCard
              book={{
                Title: "The Left Hand of Darkness",
                Author: "Ursula K. Le Guin",
                Status: "TBR",
              }}
            />
            <BookCard
              book={{
                Title: "Piranesi",
                Author: "Susanna Clarke",
                Status: "Reading",
                Borrowed: "Yes",
                BorrowedBy: "Amina",
              }}
            />
            <BookCard loading />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BookEmpty variant="library" />
            <BookEmpty variant="tbr" />
            <BookEmpty variant="to-buy" />
            <BookEmpty variant="borrowed" />
          </div>
        </div>
      </Section>
    </div>
  )
}
