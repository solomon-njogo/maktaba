import { LibraryView } from "@/components/books/library-view"

export default function TbrPage() {
  return (
    <LibraryView
      title="TBR"
      description="What is next in the reading pipeline."
      filters={{ status: "TBR" }}
      emptyVariant="tbr"
    />
  )
}
