import "dotenv/config";
import { Client } from "@notionhq/client";
import { queryPagesToEnrich, extractIsbn, updatePageFromBook } from "./notion.js";
import { fetchBookByIsbn } from "./googleBooks.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN) {
  console.error(
    "[Error] NOTION_TOKEN is not set. Create a .env file from .env.example and add your integration token."
  );
  process.exit(1);
}

if (!DATABASE_ID) {
  console.error(
    "[Error] NOTION_DATABASE_ID is not set. Add it to your .env file."
  );
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const notion = new Client({ auth: NOTION_TOKEN });

  // Both env vars are validated before main() is called; assert non-null here.
  const databaseId = DATABASE_ID as string;

  console.log(`[Maktaba] Querying database ${databaseId} for unenriched entries…`);

  const pages = await queryPagesToEnrich(notion, databaseId);

  if (pages.length === 0) {
    console.log("[Maktaba] No pages to enrich. All done.");
    return;
  }

  console.log(`[Maktaba] Found ${pages.length} page(s) to process.\n`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const page of pages) {
    const pageId = page.id;
    const rawIsbn = extractIsbn(page);

    if (!rawIsbn) {
      console.warn(`[${pageId}] Could not read ISBN property — skipping.`);
      skipped++;
      continue;
    }

    console.log(`[${pageId}] ISBN: ${rawIsbn}`);

    const book = await fetchBookByIsbn(rawIsbn);

    if (!book) {
      console.warn(`  → No book data found. Skipping update.\n`);
      skipped++;
      continue;
    }

    console.log(`  → Found: "${book.title}" by ${book.authors.join(", ") || "Unknown"}`);

    try {
      await updatePageFromBook(notion, pageId, book);
      console.log(`  → Updated successfully.\n`);
      enriched++;
    } catch {
      console.error(`  → Update failed. Moving on.\n`);
      failed++;
    }
  }

  console.log("─".repeat(50));
  console.log(
    `[Maktaba] Done.  Enriched: ${enriched}  |  Skipped: ${skipped}  |  Failed: ${failed}`
  );
}

main().catch((err) => {
  console.error("[Maktaba] Fatal error:", err);
  process.exit(1);
});
