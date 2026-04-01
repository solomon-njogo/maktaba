import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "crypto";
import { Client } from "@notionhq/client";
import { tryEnrichPageById } from "../src/enrich";

export const config = {
  api: {
    bodyParser: false,
  },
};

const PAGE_ENRICH_EVENTS = new Set([
  "page.created",
  "page.properties_updated",
  "page.content_updated",
  "page.moved",
  "page.undeleted",
]);

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function verifyNotionSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = `sha256=${digest}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

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
  // Browsers use GET; Notion webhooks use POST only.
  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      service: "Maktaba Notion webhook",
      message:
        "This URL accepts POST requests from Notion only. Configure it under your integration → Webhooks. Visiting in a browser sends GET, which does not trigger enrichment.",
    });
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD, POST");
    res.end("Method Not Allowed");
    return;
  }

  const rawBody = await readRawBody(req);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    res.statusCode = 400;
    res.end("Invalid JSON");
    return;
  }

  const isVerificationHandshake =
    typeof body.verification_token === "string" &&
    typeof body.type !== "string";

  const verificationSecret = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  if (verificationSecret && !isVerificationHandshake) {
    const sig = headerString(req.headers, "x-notion-signature");
    if (!verifyNotionSignature(rawBody, sig, verificationSecret)) {
      res.statusCode = 401;
      res.end("Invalid signature");
      return;
    }
  }

  if (isVerificationHandshake) {
    sendJson(res, 200, {
      ok: true,
      hint: "Paste verification_token in Notion → Integration → Webhooks → Verify",
    });
    return;
  }

  const notionToken = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || !databaseId) {
    console.error("[webhook] NOTION_TOKEN or NOTION_DATABASE_ID missing");
    res.statusCode = 500;
    res.end("Server misconfigured");
    return;
  }

  const type = body.type;
  const entity = body.entity as { id?: string; type?: string } | undefined;

  if (
    typeof type === "string" &&
    PAGE_ENRICH_EVENTS.has(type) &&
    entity?.type === "page" &&
    typeof entity.id === "string"
  ) {
    const notion = new Client({ auth: notionToken });
    const result = await tryEnrichPageById(notion, databaseId, entity.id);
    if (result === "enriched" || result === "failed") {
      console.log(`[webhook] ${type} ${entity.id} → ${result}`);
    }
  }

  sendJson(res, 200, { ok: true });
}
