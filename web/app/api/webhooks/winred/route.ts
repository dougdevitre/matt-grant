import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { dbConfigured } from "@/lib/db";
import { recordContribution } from "@/lib/donors";
import { normalizeWinred, extractWinredToken, classifyWinredEvent } from "@/lib/winred";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { donationThankYou } from "@/lib/email/templates";
import { getSecret } from "@/lib/ssm";

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

type Json = Record<string, unknown>;

// WinRed authenticates by adding a STATIC FIELD to the webhook JSON body (set under
// the integration's "Donation Webhook Fields" → "Add a static JSON field"), NOT an
// Authorization header — WinRed's webhook config offers no header/secret field. We
// verify that `token` field against WINRED_WEBHOOK_SECRET, read via getSecret so the
// value comes from SSM at runtime (rotating it needs no rebuild). A header fallback
// (x-winred-token / bearer) is kept so direct/manual test posts still work.
async function authorized(req: NextRequest, payload: Json): Promise<boolean> {
  const expected = await getSecret("WINRED_WEBHOOK_SECRET");
  if (!expected) return false; // refuse to run unconfigured
  const provided = extractWinredToken(payload, req.headers.get("authorization"), req.headers.get("x-winred-token"));
  return !!provided && secretMatches(provided, expected);
}

export async function POST(req: NextRequest) {
  // Parse first: WinRed's secret rides in the JSON body (static field), so we must
  // read the body before we can authenticate.
  let payload: Json;
  try {
    payload = (await req.json()) as Json;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!(await authorized(req, payload))) {
    return NextResponse.json(
      { error: "unauthorized (WinRed must send the configured `token` field matching WINRED_WEBHOOK_SECRET)" },
      { status: 401 },
    );
  }

  const rec = normalizeWinred(payload);
  const event = classifyWinredEvent(payload);
  // Refunds/disputes reverse a prior gift instead of adding one.
  const isRefund = event === "refunded" || event === "dispute_lost";
  if (!rec.amount && !rec.email) {
    // Nothing recognizable — accept (200) so WinRed doesn't hammer retries, but
    // flag it so a real schema mismatch is visible in logs.
    // Count only — don't reflect attacker-supplied field names back in the response.
    return NextResponse.json({ ok: true, note: "no recognizable donation fields", fieldCount: Object.keys(payload).length });
  }

  if (!dbConfigured) {
    return NextResponse.json({ error: "store not configured" }, { status: 503 });
  }

  try {
    // Funnel through the shared recorder so the gift lands in contributions[]
    // (counted by the dashboard) and dedupes by email; externalId makes webhook
    // retries idempotent. A refund records a NEGATIVE entry under a distinct
    // externalId (`<id>:refund`) so it both nets out the donor total and stays
    // idempotent against duplicate refund webhooks — without being deduped against
    // the original gift.
    const cents = Math.round((rec.amount ?? 0) * 100);
    await recordContribution({
      email: rec.email,
      name: rec.name,
      city: rec.city,
      state: rec.state,
      zip: rec.zip,
      employer: rec.employer,
      occupation: rec.occupation,
      amountCents: isRefund ? -cents : cents,
      method: "WinRed",
      source: "winred",
      externalId: isRefund ? (rec.externalId ? `${rec.externalId}:refund` : undefined) : rec.externalId,
      type: isRefund ? "refund" : undefined,
      recurring: rec.recurring,
      receivedAt: rec.donatedAt ?? undefined,
    });
  } catch {
    return NextResponse.json({ error: "failed to record donation" }, { status: 502 });
  }

  // Thank-you only for new gifts — never email a "thanks" for a refund/dispute.
  // Best-effort: never fail the webhook if email is down/unconfigured.
  if (!isRefund && sesEnabled && rec.email) {
    try {
      const tpl = donationThankYou(rec.firstName ?? "Friend", rec.amount);
      await sendEmail({ to: rec.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      /* recorded already; receipt is non-critical */
    }
  }

  return NextResponse.json({
    ok: true,
    recorded: true,
    event,
    refund: isRefund,
    amount: rec.amount,
    emailed: !isRefund && sesEnabled && !!rec.email,
  });
}
