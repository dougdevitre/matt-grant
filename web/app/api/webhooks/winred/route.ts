import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { dbConfigured } from "@/lib/db";
import { recordContribution } from "@/lib/donors";
import { normalizeWinred } from "@/lib/winred";
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

  const rec = normalizeWinred(payload);
  if (!rec.amount && !rec.email) {
    // Nothing recognizable — accept (200) so WinRed doesn't hammer retries, but
    // flag it so a real schema mismatch is visible in logs.
    return NextResponse.json({ ok: true, note: "no recognizable donation fields", keys: Object.keys(payload) });
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: "store not configured" }, { status: 503 });
  }

  try {
    // Funnel through the shared recorder so the gift lands in contributions[]
    // (counted by the dashboard) and dedupes by email; externalId makes webhook
    // retries idempotent.
    await recordContribution({
      email: rec.email,
      name: rec.name,
      city: rec.city,
      state: rec.state,
      zip: rec.zip,
      employer: rec.employer,
      occupation: rec.occupation,
      amountCents: Math.round((rec.amount ?? 0) * 100),
      method: "WinRed",
      source: "winred",
      externalId: rec.externalId,
      recurring: rec.recurring,
      receivedAt: rec.donatedAt ?? undefined,
    });
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
