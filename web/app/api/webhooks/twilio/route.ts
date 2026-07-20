import { NextResponse, type NextRequest } from "next/server";
import { getSecret } from "@/lib/ssm";
import { validateTwilioSignature } from "@/lib/sms/send";
import { recordConsent, recordConsentGeo, recordOptOut } from "@/lib/sms/consent";
import { setVolunteerContactOptOut } from "@/lib/volunteers/optout";
import { isBlocked } from "@/lib/sms/moderation";
import { getConversation, logInbound, setAwaitingGeo, setConversationGeo } from "@/lib/sms/conversations";
import { notifyStaffInboundText } from "@/lib/notifications/staffNotify";
import { resolveCta, welcomeReply } from "@/lib/sms/ctas";
import { askGeoReply, awaitingGeoActive, countyVoteReply, parseGeoAnswer, unknownGeoReply } from "@/lib/sms/votebot";
import { COUNTIES, countyByKey } from "@/lib/sms/geo";
import { CAMPAIGN } from "@/lib/site";

// Inbound Twilio webhook for the Messaging Service. Verifies the X-Twilio-Signature,
// then routes keyword replies:
//   STOP/UNSUBSCRIBE/CANCEL/END/QUIT → opt-out (mirrors carrier Advanced Opt-Out)
//   START/YES/UNSTOP                 → re-subscribe
//   <SMS_OPTIN_KEYWORD> (e.g. MATT)  → opt-in (text-to-join) + welcome
//   HELP                             → info reply
//   VOTE/EARLY                       → the geo-aware vote agent (lib/sms/votebot.ts):
//                                      county known → county-specific early-vote info;
//                                      else ask county/ZIP, and read the next
//                                      non-keyword text as the answer.
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
  const bodyText = params.Body ?? "";

  // Blocked numbers are fully inert: don't record consent, don't log to a thread,
  // don't reply. Silently ack so Twilio doesn't retry.
  if (await isBlocked(from)) return twiml();

  const keyword = bodyText.trim().toUpperCase().replace(/[^A-Z]/g, "");
  // Resolve the opt-in keyword via getSecret (env-first → SSM /matt-grant/*), so the
  // runbook's "store it in SSM" step actually takes effect. Defaults to MATT.
  const optIn = ((await getSecret("SMS_OPTIN_KEYWORD")) ?? "MATT").toUpperCase().replace(/[^A-Z]/g, "");

  // Keyword side effects + the reply — then log EVERY inbound message into the
  // person's thread (after the consent mutation, so a fresh read reflects
  // STOP/START). CTA keywords (DONATE/VOLUNTEER/EVENTS/VOTE, lib/sms/ctas.ts) are
  // resolved last, after the reserved words, so they never shadow STOP/START/HELP.
  let reply: string | undefined;
  const cta = STOP_WORDS.has(keyword) || START_WORDS.has(keyword) || keyword === optIn || keyword === "HELP"
    ? null
    : resolveCta(keyword);
  if (STOP_WORDS.has(keyword)) {
    await recordOptOut(from); // carrier auto-replies to STOP; don't double-send
    await setVolunteerContactOptOut({ phone: from }, true).catch(() => {}); // reflect on the roster
  } else if (START_WORDS.has(keyword) || keyword === optIn) {
    await recordConsent(from, keyword === optIn ? "sms-keyword" : "sms-start");
    await setVolunteerContactOptOut({ phone: from }, false).catch(() => {}); // re-subscribe clears it
    reply = welcomeReply();
  } else if (keyword === "HELP") {
    reply = `${CAMPAIGN.candidate} for Congress. Campaign updates. Reply STOP to opt out. ${CAMPAIGN.email}`;
  } else if (cta) {
    // Texting a CTA keyword is an opt-in that drives one action: record consent
    // (tagged with the CTA source) and reply with that action's trackable link.
    await recordConsent(from, cta.source);
    await setVolunteerContactOptOut({ phone: from }, false).catch(() => {});
    if (cta.source === "sms-cta-vote") {
      // VOTE runs the vote agent instead of the static link: answer with the
      // person's county-specific early-vote info when the thread already knows
      // their county, else ask for it and remember the open question.
      const county = countyByKey((await getConversation(from))?.county);
      if (county) {
        reply = countyVoteReply(county);
      } else {
        await setAwaitingGeo(from);
        reply = askGeoReply();
      }
    } else {
      reply = cta.reply;
    }
  }

  // A "freeform" text is one that didn't match a reserved word / opt-in keyword / CTA
  // — i.e. a real message a person wrote that needs a human reply in the Inbox.
  let handled = STOP_WORDS.has(keyword) || START_WORDS.has(keyword) || keyword === optIn || keyword === "HELP" || !!cta;

  // A non-keyword text may be the answer to the vote agent's live county/ZIP
  // question. A parsed answer is remembered (conversation + consent row — the
  // self-reported half of candidate/sms-targeting-plan.md's audience enrichment)
  // and answered with county-specific info. An answer we can't parse still gets
  // the fallback link, but stays "unhandled" so a human follows up from the Inbox.
  if (!handled) {
    const convo = await getConversation(from);
    if (awaitingGeoActive(convo)) {
      const geo = parseGeoAnswer(bodyText);
      if (geo) {
        await setConversationGeo(from, geo);
        await recordConsentGeo(from, geo); // never throws; no row → no-op
        reply = countyVoteReply(COUNTIES[geo.county]);
        handled = true;
      } else {
        reply = unknownGeoReply();
      }
    }
  }

  // Best-effort: never hold the 200 ack on a logging failure.
  try {
    const unread = await logInbound({ from, body: bodyText, sid: params.MessageSid });
    // Alert staff only on the FIRST unread of a freeform thread, so a burst of texts
    // is one email, not one per message. Fire-and-forget.
    if (!handled && unread === 1) {
      await notifyStaffInboundText({ from, bodySnippet: bodyText.slice(0, 140) }).catch(() => {});
    }
  } catch {
    /* consent already recorded; a logging miss shouldn't trigger Twilio retries */
  }

  return twiml(reply);
}
