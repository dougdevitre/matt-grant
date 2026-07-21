// SMS broadcast templates + helpers. Parallels lib/email/broadcasts.ts but much
// simpler: a short body, no rich text. build() returns the raw body; the composer
// and the campaign creator wrap it with withCompliance() before counting/sending.
import { CAMPAIGN, SITE_URL } from "@/lib/site";
import { ISSUES } from "@/lib/issues";
import { ctaLink } from "@/lib/sms/ctas";
import { earlyVotePhrase } from "@/lib/sms/votebot";

export type SmsField = { name: string; label: string; placeholder?: string };
export type SmsTemplateDef = {
  key: string;
  label: string;
  description: string;
  fields: SmsField[];
  build: (vars: Record<string, string>) => string;
};

// FEC "Paid for by" disclaimer (11 CFR 110.11) + TCPA opt-out, appended to every
// broadcast. A mass political text is a public communication, so it carries the full
// authorized-committee disclaimer — the same standard as every sample in
// messaging/sms-texting.md — reusing the single source of truth (CAMPAIGN.paidForBy
// already ends with a period).
//
// Keep every character in this suffix GSM-7 (plain hyphen, no em/en dash, smart quotes, or
// emoji). It rides on EVERY text, so one non-GSM char here forces the whole message to UCS-2
// — 70 chars/segment instead of 160 — silently ~2x-ing the segment count and cost campaign-wide.
export const SMS_COMPLIANCE_SUFFIX = ` - ${CAMPAIGN.paidForBy} Reply STOP to opt out.`;

export function withCompliance(body: string): string {
  const b = body.trim();
  return b ? `${b}${SMS_COMPLIANCE_SUFFIX}` : "";
}

// Transactional SMS receipt for a WinRed gift, sent (opt-in only) alongside the email
// thank-you. Kept factual to the campaign and GSM-7 (plain hyphen/no em dash, no curly quotes
// or emoji) so it stays a single segment after the compliance suffix even with a name + amount.
// The lifecycle sender adds the sender ID + STOP language, so this is just the thank-you line.
export function donationThankYouSms(first?: string, amountDollars?: number): string {
  const raw = (first ?? "").trim();
  // Drop a donor-supplied name that isn't GSM-7 (e.g. "François", an emoji, a curly quote):
  // a single non-GSM char would tip the whole text to UCS-2 (70 chars/segment, ~2x cost). The
  // greeting still reads fine without it. (Length: names stay short enough to keep 1 segment.)
  const who = raw && nonGsmChars(raw).length === 0 ? raw : "";
  const amt = amountDollars && amountDollars > 0 ? ` $${Math.round(amountDollars)}` : "";
  return `Thanks${who ? `, ${who}` : ""} for your${amt} gift to Matt Grant for Congress! It fuels our MO-02 campaign.`;
}

// GSM-7 charset (basic + the 9 extended chars that cost 2 septets). Used to pick
// the encoding and count segments the way carriers bill them.
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_EXT = new Set("^{}\\[~]|€");

export type SegmentInfo = { chars: number; segments: number; encoding: "GSM-7" | "UCS-2" };

export function smsSegments(text: string): SegmentInfo {
  let units = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM_BASIC.has(ch)) units += 1;
    else if (GSM_EXT.has(ch)) units += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    const segments = units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153);
    return { chars: units, segments, encoding: "GSM-7" };
  }
  const u = text.length; // UTF-16 code units, as carriers count UCS-2
  const segments = u === 0 ? 0 : u <= 70 ? 1 : Math.ceil(u / 67);
  return { chars: u, segments, encoding: "UCS-2" };
}

/** Distinct characters in `text` that aren't representable in GSM-7 — the ones forcing a
 *  message to pricier UCS-2 (70 chars/segment vs 160). Empty array = GSM-7 clean. Used by the
 *  composer to warn "a curly quote / dash / emoji is doubling your cost" and name the culprit. */
export function nonGsmChars(text: string): string[] {
  const out = new Set<string>();
  for (const ch of text) if (!GSM_BASIC.has(ch) && !GSM_EXT.has(ch)) out.add(ch);
  return [...out];
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();

// The election countdown is shared with email via lib/electionDates.ts (single
// source of truth). Imported for local use (the gotv template) AND re-exported so
// existing importers of sms/templates keep working.
import { daysUntilElection } from "@/lib/electionDates";
export { daysUntilElection };

// Fuzzy-match a typed priority ("family courts", "taxes", "term limits") to a canonical ISSUE,
// so the issue template can deep-link /issues/<slug> without a select input. null if no match.
function matchIssue(q: string): (typeof ISSUES)[number] | null {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const slug = s.replace(/\s+/g, "-");
  return (
    ISSUES.find((i) => i.slug === slug || i.slug.includes(slug) || i.title.toLowerCase().includes(s)) ??
    ISSUES.find((i) => s.split(/\s+/).some((w) => w.length > 3 && i.title.toLowerCase().includes(w))) ??
    null
  );
}

export const SMS_TEMPLATES: SmsTemplateDef[] = [
  {
    key: "reminder",
    label: "Event reminder",
    description: "Nudge supporters about an upcoming event.",
    fields: [
      { name: "what", label: "What", placeholder: "Town hall" },
      { name: "when", label: "When", placeholder: "Sat 10am" },
      { name: "where", label: "Where", placeholder: "Chesterfield" },
    ],
    build: (v) => tidy(`Reminder: ${v.what || "our campaign event"} ${v.when || ""}${v.where ? ` at ${v.where}` : ""}. Hope to see you there!`),
  },
  {
    key: "gotv",
    label: "GOTV reminder",
    description: "Get-out-the-vote push for the Aug 4 primary — the countdown fills in automatically.",
    fields: [{ name: "days", label: "Days until the primary (blank = auto)", placeholder: "auto" }],
    build: (v) => {
      const raw = v.days?.trim();
      const n = raw && !Number.isNaN(Number(raw)) ? Number(raw) : daysUntilElection();
      const phrase = n > 1 ? `${n} days away` : n === 1 ? "tomorrow" : n === 0 ? "today" : "almost here";
      return tidy(`The August 4 primary is ${phrase}. Make your plan to vote. Every vote counts.`);
    },
  },
  {
    key: "early-vote",
    label: "Early-vote push",
    description:
      "No-excuse early voting for the Aug 4 primary (July 21 - Aug 3) — the phrasing tracks the calendar automatically, and Reply VOTE hands off to the county-aware vote agent.",
    fields: [],
    build: () =>
      tidy(
        `Early voting for the Aug 4 primary ${earlyVotePhrase()}. Vote in person at your county election office - bring photo ID, no excuse needed. Reply VOTE for your county's location and info.`,
      ),
  },
  {
    key: "issue-update",
    label: "Priority spotlight",
    description: "Voter-facing update on one of Matt's four priorities, with a link to his plan.",
    fields: [
      { name: "priority", label: "Priority", placeholder: "family courts / term limits / smaller government / lower taxes" },
      { name: "note", label: "Your line (optional)", placeholder: "Big news this week:" },
    ],
    build: (v) => {
      const iss = matchIssue(v.priority || "");
      if (!iss) return tidy(`See where Matt Grant stands on the issues: ${SITE_URL}/issues`);
      const lead = v.note?.trim() ? `${v.note.trim()} ` : "";
      return tidy(`${lead}Matt's plan - ${iss.tagline} ${ctaLink(`/issues/${iss.slug}`, `issue-${iss.slug}`)}`);
    },
  },
  {
    key: "team-update",
    label: "Team update (internal)",
    description: "A logistics note or alert to the team — pair with an account-role audience (Admin/Captain/Volunteer).",
    fields: [{ name: "message", label: "Message", placeholder: "Staff meeting moved to 6pm at HQ" }],
    build: (v) => tidy(`Team: ${v.message || ""}`),
  },
  {
    key: "shift-reminder",
    label: "Shift reminder (internal)",
    description: "Remind volunteers of an upcoming canvass or phone-bank shift.",
    fields: [
      { name: "activity", label: "Activity", placeholder: "Canvass" },
      { name: "when", label: "When", placeholder: "Sat 9am" },
      { name: "where", label: "Where", placeholder: "HQ, 1625 Mason Knoll Rd" },
    ],
    build: (v) => tidy(`${v.activity || "Volunteer shift"} reminder: ${v.when || ""}${v.where ? ` at ${v.where}` : ""}. Thanks for showing up!`),
  },
  {
    key: "captain-brief",
    label: "Captain brief (internal)",
    description: "A coordination brief for team captains — this week's focus + the ask. Pair with the Captain role audience.",
    fields: [
      { name: "focus", label: "This week's focus", placeholder: "Weekend canvass push" },
      { name: "ask", label: "The ask", placeholder: "Confirm your team's Sat shifts by Thu" },
    ],
    build: (v) => tidy(`Captains - ${v.focus || "this week"}.${v.ask ? ` ${v.ask}` : ""}`),
  },
  {
    key: "custom",
    label: "Custom message",
    description: "Write your own short message.",
    fields: [{ name: "body", label: "Message", placeholder: "Your message" }],
    build: (v) => tidy(v.body || ""),
  },
];

export const getSmsTemplate = (key: string): SmsTemplateDef | undefined => SMS_TEMPLATES.find((t) => t.key === key);

export const SMS_TEMPLATE_META = SMS_TEMPLATES.map(({ key, label, description, fields }) => ({ key, label, description, fields }));
