import { NextResponse, type NextRequest } from "next/server";
import { validateTwilioSignature } from "@/lib/sms/send";
import { recordConsent, recordOptOut } from "@/lib/sms/consent";
import { CAMPAIGN } from "@/lib/site";

// Inbound Twilio webhook for the Messaging Service. Verifies the X-Twilio-Signature,
// then routes keyword replies:
//   STOP/UNSUBSCRIBE/CANCEL/END/QUIT → opt-out (mirrors carrier Advanced Opt-Out)
//   START/YES/UNSTOP                 → re-subscribe
//   <SMS_OPTIN_KEYWORD> (e.g. MATT)  → opt-in (text-to-join) + welcome
//   HELP                             → info reply
// Inert without TWILIO_AUTH_TOKEN (signature can't be verified → 403), so a keyless
// deploy is safe. Returns TwiML; Twilio's own Advanced Opt-Out may also auto-reply
// to STOP/HELP, so we don't double-reply to those.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START_WORDS = new Set(["START", "YES", "UNSTOP"]);

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const twiml = (message?: string) =>
  new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${escapeXml(message)}</Message>` : ""}</Response>`,
    { status: 200, headers: { "content-type": "text/xml" } },
  );

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "";
  const url = `${proto}://${host}${req.nextUrl.pathname}`;
  const sig = req.headers.get("x-twilio-signature") ?? "";
  if (!(await validateTwilioSignature(url, params, sig))) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const from = params.From ?? "";
  const keyword = (params.Body ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const optIn = (process.env.SMS_OPTIN_KEYWORD ?? "MATT").toUpperCase().replace(/[^A-Z]/g, "");

  if (STOP_WORDS.has(keyword)) {
    await recordOptOut(from);
    return twiml(); // carrier auto-replies; don't double-send
  }
  if (START_WORDS.has(keyword) || keyword === optIn) {
    await recordConsent(from, keyword === optIn ? "sms-keyword" : "sms-start");
    return twiml(`You're subscribed to ${CAMPAIGN.candidate} for Congress updates. Msg & data rates may apply. Reply STOP to opt out, HELP for help.`);
  }
  if (keyword === "HELP") {
    return twiml(`${CAMPAIGN.candidate} for Congress — campaign updates. Reply STOP to opt out. ${CAMPAIGN.email}`);
  }
  return twiml();
}
