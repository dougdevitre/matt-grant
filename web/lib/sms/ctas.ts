import { CAMPAIGN, SITE_URL } from "@/lib/site";

// Inbound-keyword call-to-action registry for the toll-free number. Texting a CTA
// keyword (e.g. DONATE) is an opt-in AND drives one action: the webhook records
// consent and replies with that action's trackable link. This is the classic
// "Text DONATE to 844-314-7912" pattern for signs, mailers, and the stump speech.
//
// Every reply is compliant BY CONSTRUCTION — ctaReply() always appends the FEC
// disclaimer (CAMPAIGN.paidForBy) and STOP, so no keyword can ship without them.
// Copy stays here (not scattered in the webhook) so it's the one place to edit and
// is unit-tested. Keywords are matched after STOP/START/HELP/opt-in in the route,
// so they never shadow those reserved words.

const STOP = "Reply STOP to opt out.";

/** Absolute campaign URL for a path (or pass-through for an external URL like WinRed),
 *  with UTM attribution by keyword so donations/signups trace back to the text CTA. */
export function ctaLink(pathOrUrl: string, keyword: string): string {
  const base = pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=sms&utm_medium=text&utm_campaign=${keyword.toLowerCase()}`;
}

// Full compliant reply: the lead ends with a colon, then the link, then the
// disclaimer on its own line. The link is NOT the last token (the disclaimer
// follows), which avoids trailing-punctuation eating the URL on some clients.
function ctaReply(lead: string, link: string): string {
  return `${lead} ${link}\n${CAMPAIGN.paidForBy} ${STOP}`;
}

const norm = (s: string) => s.trim().toUpperCase().replace(/[^A-Z]/g, "");

type CtaDef = {
  canonical: string; // the keyword to advertise
  aliases: string[]; // other spellings that route to the same CTA
  source: string; // consent-ledger source tag, for opt-in records + attribution
  dest: string; // site path or absolute URL
  lead: string; // sentence ending with a colon (the link is appended)
};

// Destinations are documented links only (CAMPAIGN.donateUrl + real /join, /events,
// /vote pages) — no invented URLs. Aliases avoid the reserved words HELP/STOP/START.
const DEFS: readonly CtaDef[] = [
  {
    canonical: "DONATE",
    aliases: ["GIVE", "CHIPIN", "DONATION"],
    source: "sms-cta-donate",
    dest: CAMPAIGN.donateUrl,
    lead: `Thanks for supporting ${CAMPAIGN.committee}! Chip in here:`,
  },
  {
    canonical: "VOLUNTEER",
    aliases: ["VOL"],
    source: "sms-cta-volunteer",
    dest: "/join",
    lead: `Thanks for stepping up for ${CAMPAIGN.committee}! Sign up to volunteer:`,
  },
  {
    canonical: "EVENTS",
    aliases: ["RSVP", "EVENT"],
    source: "sms-cta-events",
    dest: "/events",
    lead: `You're on the list for ${CAMPAIGN.committee}! Upcoming events + RSVP:`,
  },
  {
    canonical: "VOTE",
    aliases: ["VOTING"],
    source: "sms-cta-vote",
    dest: "/vote",
    lead: `Standing with ${CAMPAIGN.committee}? Make your plan to vote (primary ${CAMPAIGN.electionLabel}):`,
  },
];

/** The advertised CTA keywords (for docs, dashboard help, and materials). */
export const CTA_KEYWORDS: readonly string[] = DEFS.map((d) => d.canonical);

export type ResolvedCta = { source: string; reply: string };

/** Resolve an inbound keyword to a CTA opt-in + reply, or null if it isn't a CTA.
 *  Matches the canonical keyword or any alias (case/punctuation-insensitive). */
export function resolveCta(keyword: string): ResolvedCta | null {
  const k = norm(keyword);
  if (!k) return null;
  const def = DEFS.find((d) => norm(d.canonical) === k || d.aliases.some((a) => norm(a) === k));
  if (!def) return null;
  return { source: def.source, reply: ctaReply(def.lead, ctaLink(def.dest, def.canonical)) };
}

/** The general opt-in welcome (keyword MATT / START). Not a dead end: leads with a
 *  clear CTA to the campaign platform (create an account / join the community) and
 *  carries the disclaimer + opt-out. */
export function welcomeReply(): string {
  const link = ctaLink("/sign-up", "welcome");
  return (
    `You're in — welcome to Team ${CAMPAIGN.candidate}! Join the campaign platform: ${link}\n` +
    `Msg & data rates may apply. ${CAMPAIGN.paidForBy} Reply STOP to opt out, HELP for help.`
  );
}
