# UI Foundations & Design System

Dark-first, high-contrast, and built on [shadcn/ui](https://ui.shadcn.com) primitives. Browse the living catalog at `/design-system`.

## Layers

1. **Tokens** — CSS variables in `src/app/globals.css`, exposed as Tailwind utilities (`bg-background`, `max-w-page`, `px-page-x`, `size-touch`, …).
2. **Primitives** — generated components in `src/components/ui/`. Do not restyle their colors from call sites.
3. **Layout** — `PageShell`, `SiteHeader`, `SiteTabBar` in `src/components/layout/`.
4. **Composites** — Maktaba pieces in `src/components/books/` (`StatusBadge`, `BookCard`, `BookEmpty`).

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

## Layout

`md` (768px) is the chrome split. Do not copy `max-w-5xl` + stepped padding; wrap screens in `PageShell`.

| Token / utility | Role |
| :--- | :--- |
| `max-w-page` (64rem) | Content column |
| `px-page-x` | Gutters (1rem → 1.5rem at `sm` → 2rem at `lg`) |
| `--spacing-safe-top` / `--spacing-safe-bottom` | PWA / notch insets |
| `size-touch` / `min-h-touch` (44px) | Phone chrome and card overflow |
| `size-control` (2rem) | Compact `md+` controls |

- **Below `md`:** compact header (wordmark, sync, Add), bottom tabs (Library, TBR, Reading, Done, More). Add-book is a bottom sheet. Lists use a horizontal cover + meta row.
- **From `md`:** full top shelf nav, add-book as a right sheet, two-column library grid.
- Overlays (sheet, dialog, dropdown) sit above the tab bar (`z-50` vs `z-30`). Toasts offset above the tab bar on phones.

## Typography

- **UI / body:** Inter (`--font-inter` → `font-sans`)
- **Headings (h1–h4):** Geist Mono (`--font-geist-mono` → `font-heading`)

## File map

| Path | Role |
| :--- | :--- |
| `src/app/globals.css` | Tokens and `@theme` registration |
| `src/components/layout/` | PageShell, header, phone tab bar |
| `src/components/ui/` | shadcn primitives |
| `src/components/books/` | Product composites |
| `src/components/theme-provider.tsx` | `next-themes` wrapper |
| `src/app/design-system/page.tsx` | Catalog |
| `src/app/viewport.ts` | `viewport-fit: cover`, theme color |

## Adding UI

Install more primitives with the CLI from `src/`:

```bash
npx shadcn@latest add <component>
```

Compose screens from primitives first. New product patterns belong in `src/components/books/` (or a sibling product folder), not as one-off markup with hex colors.
