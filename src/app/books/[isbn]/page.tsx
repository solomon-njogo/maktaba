import type { Metadata } from "next"

import { BookPageClient } from "@/components/books/book-page-client"

export const metadata: Metadata = {
  title: "Book · Maktaba",
}

export default function BookPage() {
  return <BookPageClient />
}
