import { LibraryView } from "@/components/books/library-view"

export default function HomePage() {
  return (
    <LibraryView
      title="Library"
      description="Every title currently on the shelves."
      emptyVariant="library"
    />
  )
}
