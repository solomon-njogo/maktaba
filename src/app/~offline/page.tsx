import { LibraryView } from "@/components/books/library-view"

export default function OfflineFallbackPage() {
  return (
    <LibraryView
      title="Library"
      description="You are offline. Showing titles saved on this device."
      emptyVariant="library"
    />
  )
}
