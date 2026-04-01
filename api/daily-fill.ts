import type { IncomingMessage, ServerResponse } from "node:http";
import { Client } from "@notionhq/client";
import { fillEmptyBookFieldsFromIsbnOnce } from "../src/enrich.js";

function headerString(
  headers: IncomingMessage["headers"],
  name: string
): string | undefined {
  const v = headers[name.toLowerCase()];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    res.end("Method Not Allowed");
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (process.env.VERCEL && !cronSecret?.trim()) {
    res.statusCode = 500;
    res.end("CRON_SECRET is required for /api/daily-fill on Vercel");
    return;
  }
  if (cronSecret?.trim()) {
    const auth = headerString(req.headers, "authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      res.statusCode = 401;
      res.end("Unauthorized");
      return;
    }
  }

  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!notionToken || !databaseId) {
    res.statusCode = 500;
    res.end("NOTION_TOKEN or NOTION_DATABASE_ID missing");
    return;
  }

  const notion = new Client({ auth: notionToken });
  try {
    const summary = await fillEmptyBookFieldsFromIsbnOnce(notion, databaseId, {
      quietWhenEmpty: true,
      skipRateLimitDelay: true,
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: true, summary }));
  } catch (err) {
    console.error("[daily-fill]", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: String(err) }));
  }
}
