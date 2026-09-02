import { BookOpenIcon, BookmarkIcon, ShoppingBagIcon, UsersIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export type BookEmptyVariant = "library" | "tbr" | "to-buy" | "borrowed"

const COPY: Record<
  BookEmptyVariant,
  { title: string; description: string; icon: typeof BookOpenIcon }
> = {
  library: {
    title: "No books on the shelf",
    description: "Add a title by ISBN or manual entry to start the inventory.",
    icon: BookOpenIcon,
  },
  tbr: {
    title: "The TBR queue is empty",
    description: "Tag owned titles as TBR when they are next in the pipeline.",
    icon: BookmarkIcon,
  },
  "to-buy": {
    title: "Nothing on the acquisition list",
    description: "Save titles you plan to purchase so they do not get lost.",
    icon: ShoppingBagIcon,
  },
  borrowed: {
    title: "Nothing is out on loan",
    description: "When a book leaves the house, tag it as borrowed here.",
    icon: UsersIcon,
  },
}

type BookEmptyProps = {
  variant?: BookEmptyVariant
}

export function BookEmpty({ variant = "library" }: BookEmptyProps) {
  const { title, description, icon: Icon } = COPY[variant]

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
