import "dotenv/config";
import { Client } from "@notionhq/client";
import { enrichDatabaseOnce } from "./enrich.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const watchMode =
  process.argv.includes("--watch") || process.env.MAKTABA_WATCH === "1";

function parsePollIntervalMs(): number {
  const raw = process.env.MAKTABA_POLL_INTERVAL_MS;
  if (!raw) return 12_000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 3_000 ? n : 12_000;
}

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

async function runWatch(notion: Client, databaseId: string): Promise<void> {
  const intervalMs = parsePollIntervalMs();
  console.log(
    `[Maktaba] Watch mode — checking Notion every ${intervalMs / 1000}s. Rows with ISBN are filled or corrected from Google Books when they differ. Ctrl+C to stop.\n`
  );

  let cycleRunning = false;

  const tick = async (): Promise<void> => {
    if (!cycleRunning) {
      cycleRunning = true;
      try {
        const summary = await enrichDatabaseOnce(notion, databaseId, {
          quietWhenEmpty: true,
        });
        if (summary.enriched > 0 || summary.failed > 0) {
          console.log(
            `[Maktaba] ${new Date().toISOString()}  enriched: ${summary.enriched}  skipped: ${summary.skipped}  failed: ${summary.failed}`
          );
        }
      } catch (err) {
        console.error("[Maktaba] Poll error:", err);
      } finally {
        cycleRunning = false;
      }
    }
    setTimeout(() => void tick(), intervalMs);
  };

  await tick();
}

async function main(): Promise<void> {
  const notion = new Client({ auth: NOTION_TOKEN });
  const databaseId = DATABASE_ID as string;

  if (watchMode) {
    await runWatch(notion, databaseId);
    return;
  }

  await enrichDatabaseOnce(notion, databaseId);
}

main().catch((err) => {
  console.error("[Maktaba] Fatal error:", err);
  process.exit(1);
});
