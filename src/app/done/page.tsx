import { LibraryView } from "@/components/books/library-view"

export default function DonePage() {
  return (
    <LibraryView
      title="Done"
      description="Finished books and reading history."
      filters={{ status: "Done" }}
      emptyVariant="done"
    />
  )
}
