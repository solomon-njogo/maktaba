# UI Foundations & Design System

Dark-first, high-contrast, and built on [shadcn/ui](https://ui.shadcn.com) primitives. Browse the living catalog at `/design-system`.

## Layers

1. **Tokens** — CSS variables in `src/app/globals.css`, exposed as Tailwind utilities (`bg-background`, `bg-status-tbr`, …).
2. **Primitives** — generated components in `src/components/ui/`. Do not restyle their colors from call sites.
3. **Composites** — Maktaba pieces in `src/components/books/` (`StatusBadge`, `BookCard`, `BookEmpty`).

## Palette

Documented hex values map onto semantic tokens (OKLCH, near-zero chroma):

| Name | Hex | Token (dark) |
| :--- | :--- | :--- |
| Surface Dark | `#0A0A0C` | `--background` |
| Surface Elevated | `#141417` | `--card`, `--popover`, `--surface` |
| Primary Accent | `#FFFFFF` | `--foreground`, `--primary` |
| Muted Boundary | `#26262B` | `--border`, `--input` |

`--primary-foreground` is near-black so primary buttons stay ink-on-white. `--destructive` stays the shadcn red for remove/delete.

Light `:root` values exist so tokens resolve; the app defaults to `class="dark"` via `next-themes` (`defaultTheme="dark"`, system preference off).

## Status tokens

Use these only through `StatusBadge` (or `BookCard`, which includes it). Do not paint status with raw `Badge` variants.

| Status | Background | Foreground |
| :--- | :--- | :--- |
| TBR | `--status-tbr` | `--status-tbr-foreground` |
| Reading | `--status-reading` | `--status-reading-foreground` |
| Done | `--status-done` | `--status-done-foreground` |
| To-Buy | `--status-to-buy` | `--status-to-buy-foreground` |
| Borrowed (overlay) | `--status-borrowed` | `--status-borrowed-foreground` |

Borrowed is an overlay (`Borrowed === "Yes"`), not a reading-pipeline status.

Generic tags, counts, and chrome use `Badge` from `components/ui`. Pipeline and loan state use `StatusBadge`.

## Typography

- **UI / body:** Inter (`--font-inter` → `font-sans`)
- **Headings (h1–h4):** Geist Mono (`--font-geist-mono` → `font-heading`)

## File map

| Path | Role |
| :--- | :--- |
| `src/app/globals.css` | Tokens and `@theme` registration |
| `src/components/ui/` | shadcn primitives |
| `src/components/books/` | Product composites |
| `src/components/theme-provider.tsx` | `next-themes` wrapper |
| `src/app/design-system/page.tsx` | Catalog |

## Adding UI

Install more primitives with the CLI from `src/`:

```bash
npx shadcn@latest add <component>
```

Compose screens from primitives first. New product patterns belong in `src/components/books/` (or a sibling product folder), not as one-off markup with hex colors.
