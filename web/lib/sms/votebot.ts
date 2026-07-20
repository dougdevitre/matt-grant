// The SMS vote agent — the conversational layer behind the VOTE keyword.
//
// Deterministic and compliant by construction (no AI): VOTE asks which MO-02
// county the person votes in (or their ZIP); the answer gets a county-specific
// early-vote reply — election authority, office address, phone, and the dates
// that matter. Every reply carries the FEC disclaimer + STOP, mirroring
// lib/sms/ctas.ts. Pure functions only; the webhook (app/api/webhooks/twilio)
// owns all I/O, and conversation state is one `awaiting` flag on the SMSCONVO
// row (lib/sms/conversations.ts).
//
// Dates are from candidate/absentee-voting-guide.md (verified 2026-06-24,
// re-checked 2026-07-10): no-excuse in-person July 21 – 5pm Aug 3; by-mail
// application received by 5pm Wed July 22; Election Day Aug 4, polls 6am–7pm.
// Keep all copy GSM-7 (plain hyphens, no smart quotes) — see lib/sms/templates.ts.

import { CAMPAIGN, SITE_URL } from "@/lib/site";
import { ctaLink } from "@/lib/sms/ctas";
import { matchCountyName, matchZip, type County, type CountyKey } from "@/lib/sms/geo";

export const EARLY_VOTE_OPENS = "2026-07-21T00:00:00-05:00"; // Tue Jul 21 (Central)
export const EARLY_VOTE_ENDS = "2026-08-03T17:00:00-05:00"; // 5pm Mon Aug 3
export const MAIL_APP_DEADLINE = "2026-07-22T17:00:00-05:00"; // 5pm Wed Jul 22

const STOP = "Reply STOP to opt out.";
const disclaim = (body: string) => `${body}\n${CAMPAIGN.paidForBy} ${STOP}`;
const guideLink = () => ctaLink("/vote/absentee", "VOTE");

/** Calendar-aware early-vote clause, completing "Early voting …". */
export function earlyVotePhrase(now: Date = new Date()): string {
  const t = now.getTime();
  if (t < new Date(EARLY_VOTE_OPENS).getTime()) return "starts Tue July 21 and runs through 5pm Mon Aug 3";
  if (t <= new Date(EARLY_VOTE_ENDS).getTime()) return "is open now through 5pm Mon Aug 3";
  return "has ended - vote on Election Day, Tue Aug 4, 6am-7pm";
}

/** The question VOTE asks when we don't yet know the person's county. */
export function askGeoReply(): string {
  return disclaim(
    "Happy to help you vote early! Which county do you vote in? Reply ST LOUIS, FRANKLIN, JEFFERSON, WASHINGTON, CRAWFORD or GASCONADE - or your 5-digit ZIP.",
  );
}

/** County-specific early-vote answer: where, who, and the live deadlines. */
export function countyVoteReply(county: County, now: Date = new Date()): string {
  const mail =
    now.getTime() <= new Date(MAIL_APP_DEADLINE).getTime()
      ? " Mail-ballot applications must ARRIVE by 5pm Wed July 22."
      : "";
  return disclaim(
    `${county.name}: early voting ${earlyVotePhrase(now)}. Vote in person at the ${county.authority}, ${county.office} - ${county.phoneLabel}. Bring photo ID, no excuse needed.${mail} Details: ${guideLink()}`,
  );
}

/** Fallback when an answer matches no MO-02 county or verified ZIP. */
export function unknownGeoReply(): string {
  return disclaim(
    `Sorry - we couldn't match that to one of the six MO-02 counties. Find your county election authority and early-voting details: ${guideLink()}`,
  );
}

export type GeoAnswer = { county: CountyKey; zip?: string };

/** Parse a texted answer to the county question: a verified ZIP wins (exact data),
 *  then a county name. Null when neither matches — the caller sends the fallback. */
export function parseGeoAnswer(raw: string): GeoAnswer | null {
  const byZip = matchZip(raw);
  if (byZip) return { county: byZip.county.key, zip: byZip.zip };
  const byName = matchCountyName(raw);
  return byName ? { county: byName.key } : null;
}

// How long an unanswered county question stays live. After this, a stray 5-digit
// text (an address fragment, a dollar figure) is no longer read as a ZIP answer.
export const GEO_AWAIT_TTL_MS = 24 * 60 * 60 * 1000;

/** True when a conversation has a live (un-expired) county question outstanding. */
export function awaitingGeoActive(
  convo: { awaiting?: string; awaitingAt?: string } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (convo?.awaiting !== "geo" || !convo.awaitingAt) return false;
  const at = new Date(convo.awaitingAt).getTime();
  return Number.isFinite(at) && now.getTime() - at <= GEO_AWAIT_TTL_MS;
}
