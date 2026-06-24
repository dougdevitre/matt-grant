import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { getSecret } from "@/lib/ssm";
import { rateLimit } from "@/lib/ratelimit";
import { secretMatches } from "@/lib/webhookAuth";
import { verifySnsMessage } from "@/lib/sns";
import { parseSesNotification, type InboundEmail } from "@/lib/events/mime";
import { parseForwardedEmail } from "@/lib/events/parseEmail";
import { createEvent } from "@/lib/events";

// Inbound email → DRAFT event (Phase 2). Two ways in:
//
//   1. AWS SES inbound (the configured path): MX → SES receipt rule → SNS → here.
//      The body is an SNS envelope; we verify its signature (lib/sns), optionally
//      pin INBOUND_SNS_TOPIC_ARN, auto-confirm the subscription, and turn the SES
//      "Received" notification into from/subject/text (lib/events/mime). Inbound
//      mail never leaves the AWS account.
//   2. A generic parse-provider POST (Postmark/SendGrid/…) of flat JSON, gated by a
//      shared secret (INBOUND_EMAIL_SECRET) via `Authorization: Bearer` or `?secret=`.
//      Kept as a fallback so a provider can be swapped in without code changes.
//
// Either way: parsed events land as DRAFT for human review (never auto-publish,
// never auto-notify), and a sha256 dedupe key makes retries idempotent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(req: Request): Promise<boolean> {
  const secret = await getSecret("INBOUND_EMAIL_SECRET");
  if (!secret) return false; // fail closed when unconfigured
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const query = new URL(req.url).searchParams.get("secret") ?? "";
  return secretMatches(bearer, secret) || secretMatches(query, secret);
}

// Tolerate the common provider field names (Postmark TextBody, SendGrid text, …).
function readPayload(j: Record<string, unknown>): InboundEmail {
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

// Shared tail: dedupe, parse with the LLM, and create a DRAFT event.
async function ingest({ from, subject, text }: InboundEmail) {
  const content = `${subject}\n\n${text}`.trim();
  if (!content) return NextResponse.json({ ok: true, skipped: "empty" });

  // Light abuse guard per sender (fail-open by design).
  const rl = await rateLimit(`inbound-email:${from || "unknown"}`, { limit: 30, windowSec: 86_400 });
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "rate limit" }, { status: 429 });

  // Idempotency: claim a dedupe key so retries don't create duplicates.
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

// AWS SES inbound arrives wrapped in an SNS envelope (signature-verified).
async function handleSns(msg: Record<string, string>) {
  const expected = process.env.INBOUND_SNS_TOPIC_ARN;
  if (expected && msg.TopicArn !== expected) {
    return NextResponse.json({ ok: false, error: "unexpected topic" }, { status: 403 });
  }
  if (!(await verifySnsMessage(msg))) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 403 });
  }

  // First-time setup: SNS sends a confirmation we must accept.
  if (msg.Type === "SubscriptionConfirmation" && msg.SubscribeURL) {
    try {
      await fetch(msg.SubscribeURL);
    } catch {
      /* AWS retries */
    }
    return NextResponse.json({ ok: true, confirmed: true });
  }

  if (msg.Type === "Notification" && typeof msg.Message === "string") {
    let notif: Record<string, unknown>;
    try {
      notif = JSON.parse(msg.Message);
    } catch {
      return NextResponse.json({ ok: true, note: "unparsable message" });
    }
    if (notif.notificationType !== "Received") return NextResponse.json({ ok: true, note: "ignored" });
    const email = parseSesNotification(notif);
    if (!email) return NextResponse.json({ ok: true, skipped: "no-mail" });
    return ingest(email);
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false, error: "bad payload" }, { status: 400 });
  }

  // SES/SNS path — authenticated by the SNS signature, not the shared secret.
  if (typeof parsed.Type === "string" && typeof parsed.SigningCertURL === "string") {
    return handleSns(parsed as Record<string, string>);
  }

  // Generic parse-provider path — shared-secret gated.
  if (!(await authorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return ingest(readPayload(parsed));
}
