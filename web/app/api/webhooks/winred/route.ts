import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { dbConfigured } from "@/lib/db";
import { recordContribution } from "@/lib/donors";
import { normalizeWinred, extractWinredToken, classifyWinredEvent } from "@/lib/winred";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { donationThankYou } from "@/lib/email/templates";
import { donorSummaryForEmail } from "@/lib/donorStatus";
import { ladderTierForCents } from "@/lib/donorLadder";
import { notifyAdminsNewDonation } from "@/lib/notifications/staffNotify";
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

  // A gift event that carries contact info but no parseable amount means the
  // payload's amount field didn't match the normalizer — the donor would land at
  // $0. Record the contact (so the donation isn't lost) but warn loudly so the
  // schema mismatch is visible in logs and can be mapped in normalizeWinred.
  if (!isRefund && !rec.amount && rec.email) {
    console.warn("[winred] donation recorded with no parseable amount — check payload field names against normalizeWinred", { event, fieldCount: Object.keys(payload).length });
  }

  // Whether THIS delivery recorded a new gift. WinRed delivers at-least-once, so a retry of an
  // already-recorded gift returns false — and every side effect below (receipt email, admin
  // notify, thank-you SMS, role upgrade) is gated on it so a donor is never double-thanked.
  let recordedNew = false;
  try {
    // Funnel through the shared recorder so the gift lands in contributions[]
    // (counted by the dashboard) and dedupes by email; externalId makes webhook
    // retries idempotent. A refund records a NEGATIVE entry under a distinct
    // externalId (`<id>:refund`) so it both nets out the donor total and stays
    // idempotent against duplicate refund webhooks — without being deduped against
    // the original gift.
    const cents = Math.round((rec.amount ?? 0) * 100);
    recordedNew = await recordContribution({
      email: rec.email,
      name: rec.name,
      phone: rec.phone,
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

  // Thank-you only for NEW gifts — never email a "thanks" for a refund/dispute, and never
  // re-send on a duplicate webhook delivery (recordedNew is false for a deduped externalId).
  // Best-effort: never fail the webhook if email is down/unconfigured.
  if (recordedNew && !isRefund && sesEnabled && rec.email) {
    try {
      // Donor value ladder: recognition keys on the donor's cycle-to-date total
      // (this gift is already recorded above), so the email names the highest
      // level reached — or none, below the first rung. Best-effort.
      const summary = await donorSummaryForEmail(rec.email).catch(() => null);
      const tier = ladderTierForCents(summary?.totalCents ?? 0);
      const tpl = donationThankYou(rec.firstName ?? "Friend", rec.amount, tier?.name);
      await sendEmail({ to: rec.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    } catch {
      /* recorded already; receipt is non-critical */
    }
    // Notify admins by role of the new gift (best-effort; the function self-guards).
    await notifyAdminsNewDonation({ name: rec.name, amount: rec.amount, email: rec.email, city: rec.city, recurring: rec.recurring });
  }

  // Opt-in SMS receipt — ONLY when the donor checked the SMS-consent box on the WinRed form
  // (rec.smsConsent). A donation alone is NOT SMS consent under TCPA, so we gate strictly on the
  // explicit flag: record that consent in the ledger, then send. sendLifecycleText itself re-checks
  // the recorded opt-in, so it no-ops if consent wasn't recorded — defense in depth. Best-effort;
  // never fails the webhook. (Independent of SES so a texting-only receipt still works.)
  if (recordedNew && !isRefund && rec.phone && rec.smsConsent === true) {
    try {
      const { recordConsent } = await import("@/lib/sms/consent");
      const { sendLifecycleText } = await import("@/lib/sms/lifecycle");
      const { donationThankYouSms } = await import("@/lib/sms/templates");
      await recordConsent(rec.phone, "winred");
      await sendLifecycleText({ to: rec.phone, body: donationThankYouSms(rec.firstName, rec.amount), by: "winred" });
    } catch {
      /* the gift is recorded; the SMS receipt is non-critical */
    }
  }

  // On a new gift, promote a public supporter to the `donor` role so they get the
  // private "my giving" portal. Guarded (never downgrades staff/partner) and
  // best-effort — refunds and not-yet-signed-up givers are skipped.
  if (recordedNew && !isRefund && rec.email) {
    try {
      const { upgradeToDonorByEmail } = await import("@/lib/clerkRoles");
      await upgradeToDonorByEmail(rec.email);
    } catch {
      /* role upgrade is best-effort; the gift is already recorded */
    }
    // Reconcile a /join "Donor Pledge" into a fulfilled gift so staff stop chasing it.
    try {
      const { reconcilePledgeOnGift } = await import("@/lib/volunteers/pledge");
      await reconcilePledgeOnGift(rec.email, Math.round((rec.amount ?? 0) * 100));
    } catch {
      /* best-effort; the gift is already recorded */
    }
  }

  return NextResponse.json({
    ok: true,
    recorded: recordedNew, // false = duplicate delivery of an already-recorded gift (no side effects re-fired)
    event,
    refund: isRefund,
    amount: rec.amount,
    emailed: recordedNew && !isRefund && sesEnabled && !!rec.email,
    textConsent: recordedNew && !isRefund && !!rec.phone && rec.smsConsent === true,
  });
}
