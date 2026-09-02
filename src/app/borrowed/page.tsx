import { LibraryView } from "@/components/books/library-view"

export default function BorrowedPage() {
  return (
    <LibraryView
      title="Borrowed"
      description="Books that are out on loan."
      filters={{ borrowed: "Yes" }}
      emptyVariant="borrowed"
    />
  )
}
