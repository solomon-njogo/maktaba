import { LibraryView } from "@/components/books/library-view"

export default function ToBuyPage() {
  return (
    <LibraryView
      title="To-Buy"
      description="Titles planned for purchase."
      filters={{ status: "To-Buy" }}
      emptyVariant="to-buy"
    />
  )
}
