import { NextResponse, type NextRequest } from "next/server";
import { validateTwilioSignature } from "@/lib/sms/send";
import { updateMessageStatusBySid } from "@/lib/sms/conversations";
import { recordCampaignDelivery } from "@/lib/sms/campaigns";

// Twilio message-status callback (set as StatusCallback on every send in lib/sms/send.ts).
// Twilio POSTs delivery receipts — MessageStatus ∈ queued|sent|delivered|undelivered|failed
// — as the carrier reports back. We verify the X-Twilio-Signature (same HMAC as the inbound
// webhook), then reflect the status on the matching 1:1 thread bubble. Unknown SIDs
// (broadcast/test sends, which aren't in a thread) no-op. Inert without TWILIO_AUTH_TOKEN
// (signature can't verify → 403), so a keyless deploy is safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only carrier-meaningful transitions are worth persisting; "queued"/"sent" are the
// pre-delivery states the bubble already shows.
const TERMINAL = new Set(["delivered", "undelivered", "failed"]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  // MUST include the query string: Twilio signs the full callback URL, and
  // broadcast sends carry a ?c=<campaign key> param. Validating against the
  // pathname alone would reject every broadcast receipt as an invalid signature.
  const url = `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  if (!(await validateTwilioSignature(url, params, sig))) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const sid = params.MessageSid ?? "";
  const status = (params.MessageStatus ?? params.SmsStatus ?? "").toLowerCase();
  const to = params.To ?? "";
  // Best-effort: never fail the callback (Twilio would retry). Only persist terminal
  // states; earlier states are already implied by the send.
  if (sid && to && TERMINAL.has(status)) {
    await updateMessageStatusBySid(to, sid, status).catch(() => {});
    // Broadcast receipts have no thread row to land on — tally them on the
    // campaign instead, so "delivered" stops being invisible. `sentCount` only
    // ever meant "Twilio accepted the API call", not "the handset got it".
    const campaignKey = req.nextUrl.searchParams.get("c");
    if (campaignKey) await recordCampaignDelivery(campaignKey, status).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
