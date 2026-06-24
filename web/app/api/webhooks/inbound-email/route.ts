import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { getSecret } from "@/lib/ssm";
import { rateLimit } from "@/lib/ratelimit";
import { parseForwardedEmail } from "@/lib/events/parseEmail";
import { createEvent } from "@/lib/events";

// Inbound email → draft event. PHASE 2 endpoint: it works the moment an inbound
// parse provider (Postmark/SendGrid/Mailgun) is pointed at it via MX +
// events@mattgrantforcongress.org, but until then it simply isn't called. Auth is a
// shared bearer secret (INBOUND_EMAIL_SECRET) so only the configured provider can
// post. Parsed events always land as DRAFT for human review — never auto-publish,
// never auto-notify. Dedupe (sha256 of From+Subject+body) makes provider retries
// idempotent. Until INBOUND_EMAIL_SECRET is set the route fails closed (401).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(req: Request): Promise<boolean> {
  const secret = await getSecret("INBOUND_EMAIL_SECRET");
  if (!secret) return false; // fail closed when unconfigured
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Tolerate the common provider field names (Postmark TextBody, SendGrid text, …).
function readPayload(j: Record<string, unknown>): { from: string; subject: string; text: string } {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = j[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };
  return {
    from: pick("from", "From", "sender", "Sender"),
    subject: pick("subject", "Subject"),
    text: pick("text", "TextBody", "stripped-text", "body-plain", "body", "plain"),
  };
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let j: Record<string, unknown> = {};
  try {
    j = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad payload" }, { status: 400 });
  }
  const { from, subject, text } = readPayload(j);
  const content = `${subject}\n\n${text}`.trim();
  if (!content) return NextResponse.json({ ok: true, skipped: "empty" });

  // Light abuse guard per sender (fail-open by design).
  const rl = await rateLimit(`inbound-email:${from || "unknown"}`, { limit: 30, windowSec: 86_400 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "rate limit" }, { status: 429 });

  // Idempotency: claim a dedupe key so provider retries don't create duplicates.
  const dedupeKey = crypto.createHash("sha256").update(`${from}|${subject}|${text.slice(0, 500)}`).digest("hex").slice(0, 40);
  if (dbConfigured) {
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: { PK: PK.eventIngest, SK: dedupeKey, from, subject, createdAt: new Date().toISOString() },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
    } catch (e) {
      if ((e as { name?: string })?.name === "ConditionalCheckFailedException") {
        return NextResponse.json({ ok: true, status: "duplicate" });
      }
      throw e;
    }
  }

  const draft = await parseForwardedEmail(content);
  if (!draft) return NextResponse.json({ ok: true, status: "unparsed" });

  const id = await createEvent({
    title: draft.title,
    type: draft.type,
    // No date parsed → park it at "now" so it has a sort key; staff fix it in review.
    start: draft.start || new Date().toISOString(),
    end: draft.end,
    location: draft.location,
    description: draft.description,
    status: "DRAFT",
    source: "email",
    parseConfidence: draft.confidence,
    createdBy: from || "events@inbound",
  });
  return NextResponse.json({ ok: true, status: "draft-created", id, confidence: draft.confidence });
}
