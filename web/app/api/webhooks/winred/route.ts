import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { donationThankYou } from "@/lib/email/templates";

// WinRed donation webhook: records each contribution to the donor partition and
// fires a branded thank-you receipt. Secured by a shared secret you configure in
// WinRed and store as WINRED_WEBHOOK_SECRET — inert (401) without it, so keyless
// builds/deploys still pass and an unconfigured endpoint can't be abused.
//
// NOTE: WinRed's payload field names should be confirmed against a real sample
// from your account's webhook. The normalizer below maps the documented shape
// (amount in cents, nested `donor` object) and degrades gracefully on variants.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Constant-time compare so the secret check can't be timed. Hash first so inputs
// are equal-length regardless of the provided token.
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function authorized(req: NextRequest): boolean {
  const expected = process.env.WINRED_WEBHOOK_SECRET;
  if (!expected) return false; // refuse to run unconfigured
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const provided = bearer || req.headers.get("x-winred-token") || "";
  return !!provided && secretMatches(provided, expected);
}

type Json = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// Pull the first present value across candidate dot-paths.
function pick(obj: Json, ...paths: string[]): unknown {
  for (const p of paths) {
    const v = p.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Json)[k] : undefined), obj);
    if (v != null) return v;
  }
  return undefined;
}

function normalize(payload: Json) {
  // Some webhook configs wrap the donation as { data: {...} }.
  const d = (payload.data && typeof payload.data === "object" ? (payload.data as Json) : payload) as Json;

  const cents = Number(pick(d, "amount", "amount_cents", "donation.amount", "total_amount"));
  const amountDollars = Number.isFinite(cents) && cents > 0 ? Math.round(cents) / 100 : undefined;

  const first = str(pick(d, "donor.first_name", "first_name", "billing.first_name"));
  const last = str(pick(d, "donor.last_name", "last_name", "billing.last_name"));
  const email = str(pick(d, "donor.email", "email", "billing.email"));

  return {
    externalId: str(pick(d, "id", "donation.id", "transaction_id")),
    amount: amountDollars,
    firstName: first,
    lastName: last,
    name: [first, last].filter(Boolean).join(" ") || undefined,
    email,
    city: str(pick(d, "donor.city", "billing.city", "city")),
    state: str(pick(d, "donor.state", "billing.state", "state")),
    zip: str(pick(d, "donor.zip", "billing.zip", "zip")),
    employer: str(pick(d, "donor.employer", "employer")),
    occupation: str(pick(d, "donor.occupation", "occupation")),
    recurring: Boolean(pick(d, "recurring", "is_recurring")),
    donatedAt: str(pick(d, "created_at", "donation.created_at", "timestamp")),
  };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: "unauthorized (set WINRED_WEBHOOK_SECRET and send it as a bearer token or x-winred-token)" },
      { status: 401 },
    );
  }

  let payload: Json;
  try {
    payload = (await req.json()) as Json;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rec = normalize(payload);
  if (!rec.amount && !rec.email) {
    // Nothing recognizable — accept (200) so WinRed doesn't hammer retries, but
    // flag it so a real schema mismatch is visible in logs.
    return NextResponse.json({ ok: true, note: "no recognizable donation fields", keys: Object.keys(payload) });
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: "store not configured" }, { status: 503 });
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: PK.donors,
          SK: newId(),
          source: "winred",
          externalId: rec.externalId,
          name: rec.name,
          email: rec.email,
          amount: rec.amount,
          recurring: rec.recurring,
          city: rec.city,
          state: rec.state,
          zip: rec.zip,
          employer: rec.employer,
          occupation: rec.occupation,
          status: "RECEIVED",
          donatedAt: rec.donatedAt,
          createdAt: new Date().toISOString(),
        },
      }),
    );
  } catch {
    return NextResponse.json({ error: "failed to record donation" }, { status: 502 });
  }

  // Best-effort thank-you — never fail the webhook if email is down/unconfigured.
  if (sesEnabled && rec.email) {
    try {
      const tpl = donationThankYou(rec.firstName ?? "Friend", rec.amount);
      await sendEmail({ to: rec.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      /* recorded already; receipt is non-critical */
    }
  }

  return NextResponse.json({ ok: true, recorded: true, amount: rec.amount, emailed: sesEnabled && !!rec.email });
}
