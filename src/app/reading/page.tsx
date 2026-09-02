import { LibraryView } from "@/components/books/library-view"

export default function ReadingPage() {
  return (
    <LibraryView
      title="Reading"
      description="Titles currently in progress."
      filters={{ status: "Reading" }}
      emptyVariant="reading"
    />
  )
}
