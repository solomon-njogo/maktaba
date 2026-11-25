# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solomon Njogo is the sole user. He manages a growing physical book collection and reading pipeline on phone and desktop, often offline, as a personal PWA.

## Product Purpose

Maktaba is the single source of truth for Solomon's physical books: what he owns, what he is reading, what is next (TBR), what he plans to buy, and what is out on loan. Success means he can inventory, update status, and avoid duplicates without friction across years of collecting.

## Positioning

A personal ISBN-keyed shelf and reading pipeline for one owner's physical volumes — not a social network, ebook reader, or shared catalog.

## Operating Context

- Add books by scanning or pasting ISBN; catalog lookup fills title/author when online.
- Browse and search the shelf; change Status and Borrowed state from list actions or book detail.
- Home surfaces the current Reading book (or starting the next from TBR) and shelf counts.
- Offline-first: local IndexedDB with a pending sync queue to Airtable when back online.

## Capabilities and Constraints

- Every tracked book has an ISBN.
- Status pipeline: Reading, Done, TBR, To-Buy. Borrowed is an overlay, not a status.
- Shelf = owned books (status is not To-Buy); borrowed books remain on the shelf.
- Undecided: multi-user, dark mode as a product requirement, reading goals/percent progress (explicitly out of glossary).

## Brand Commitments

- Name: Maktaba.
- Terminology follows `GLOSSARY.md` (Book, ISBN, Status, Reading, Shelf, To-Buy, Borrowed).
- Existing warm light UI and shadcn primitives are the incumbent system; this UX pass preserves that world.

## Evidence on Hand

- Live personal library data via Airtable (not fabricated for demos).
- Product docs under `documentation/`, glossary at `GLOSSARY.md`.

## Product Principles

1. One owner's truth — inventory and pipeline stay consistent and duplicate-safe.
2. Phone-first operation with desktop parity for the same three destinations.
3. Offline continuity — actions queue; sync state is visible.
4. Familiar library patterns over novel chrome — shelves, search, and clear next actions.
5. Use the product's own words (TBR, To-Buy, Borrowed) without inventing competing vocabulary.

## Accessibility & Inclusion

Touch targets meet ~44px on phone chrome. Keyboard focus and contrast follow the existing design system. No additional product-specific a11y requirements recorded.
