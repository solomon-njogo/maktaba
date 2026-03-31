# Maktaba

A CLI tool that enriches a Notion book library database by looking up metadata from Google Books using ISBNs.

Given a Notion database where entries have an **ISBN** but no title yet, Maktaba queries the Google Books API and automatically fills in the **Name**, **Author**, **Summary**, and cover thumbnail for each unenriched entry.

---

## How It Works

1. Queries the Notion database for pages where `ISBN` is set but `Name` is empty.
2. For each page, extracts and validates the ISBN (ISBN-10 or ISBN-13).
3. Fetches book metadata from the Google Books API.
4. Updates the Notion page with the book's title, author(s), description, and cover image.
5. Respects Notion's rate limits with a 300ms delay between updates.

---

## Prerequisites

- **Node.js** >= 18
- A [Notion integration](https://www.notion.so/my-integrations) with access to your database
- A Notion database with the following properties:
  | Property | Type      | Purpose                          |
  |----------|-----------|----------------------------------|
  | `ISBN`   | Rich Text | ISBN-10 or ISBN-13 of the book   |
  | `Name`   | Title     | Book title (filled by Maktaba)   |
  | `Author` | Rich Text | Author(s) (filled by Maktaba)    |
  | `Summary`| Rich Text | Description (filled by Maktaba)  |

---

## Setup

**1. Clone and install dependencies**

```bash
git clone <repo-url>
cd maktaba
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: your Notion integration secret
NOTION_TOKEN=your_notion_integration_secret

# Required: the Notion database to enrich
NOTION_DATABASE_ID=your_notion_database_id

# Optional: Google Books API key for higher quota
# GOOGLE_BOOKS_API_KEY=AIza...
```

**3. Share your Notion database with the integration**

In Notion, open the database → **···** menu → **Add connections** → select your integration.

---

## Usage

**Run directly (development)**

```bash
npm run dev
```

**Build and run**

```bash
npm run build
npm start
```

Maktaba will process all unenriched entries and print a summary:

```
[Maktaba] Querying database abc123 for unenriched entries…
[Maktaba] Found 3 page(s) to process.

[page-id-1] ISBN: 9780141036144
  → Found: "Nineteen Eighty-Four" by George Orwell
  → Updated successfully.

...

──────────────────────────────────────────────────
[Maktaba] Done.  Enriched: 3  |  Skipped: 0  |  Failed: 0
```

---

## Project Structure

```
src/
├── index.ts        # Entry point — orchestrates the enrichment loop
├── notion.ts       # Notion API helpers (query, extract ISBN, update page)
├── googleBooks.ts  # Google Books API client
└── isbn.ts         # ISBN normalization and validation
```

---

## Dependencies

| Package              | Purpose                        |
|----------------------|--------------------------------|
| `@notionhq/client`   | Official Notion API client     |
| `axios`              | HTTP client for Google Books   |
| `dotenv`             | Loads `.env` configuration     |
