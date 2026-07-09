import { CAMPAIGN } from "@/lib/site";
import { ISSUES } from "@/lib/issues";
import { ctaLink } from "@/lib/sms/ctas";

// Quick-reply links for the 1:1 inbox: a curated set of campaign-site destinations a staffer
// can drop into a reply so the texter can research from their phone. Each carries a short,
// platform-faithful lead sentence and UTM attribution (via ctaLink). Keyword `match` lets the
// composer surface the RIGHT link for what the person just texted ("corruption" -> family
// courts). Copy stays GSM-7 (plain hyphen, straight quotes) so an insert doesn't force UCS-2.
export type ReplyLink = {
  group: "Platform" | "Act" | "Vote" | "Give" | "More";
  label: string;
  campaign: string; // utm_campaign slug
  dest: string; // site path, or an absolute URL (WinRed) that passes through
  snippet: string; // on-message lead placed before the link
  match: string[]; // lowercase substrings of an inbound text that surface this link
};

// The four priorities, derived from the canonical ISSUES registry so slugs never drift.
const ISSUE_META: Record<string, { label: string; snippet: string; match: string[] }> = {
  "family-courts": {
    label: "Family courts",
    snippet: "Matt's top fight is ending corruption in the family courts. Here's his plan:",
    match: ["corrupt", "court", "custody", "child", "kid", "family", "docket"],
  },
  "term-limits": {
    label: "Term limits",
    snippet: "Matt backs term limits for the House and Senate - service, not careerism:",
    match: ["term limit", "career", "incumbent"],
  },
  "smaller-government": {
    label: "Smaller govt",
    snippet: "Matt wants a smaller, leaner federal government - right-size Washington:",
    match: ["government", "spending", "waste", "bureaucrac", "big government"],
  },
  "lower-taxes": {
    label: "Lower taxes",
    snippet: "Matt's plan is to cut waste first, then lower taxes:",
    match: ["tax", "irs"],
  },
};

const priorityLinks: ReplyLink[] = ISSUES.map((i) => ({
  group: "Platform" as const,
  label: ISSUE_META[i.slug]?.label ?? i.title,
  campaign: `issue-${i.slug}`,
  dest: `/issues/${i.slug}`,
  snippet: ISSUE_META[i.slug]?.snippet ?? `${i.title}:`,
  match: ISSUE_META[i.slug]?.match ?? [],
}));

const otherLinks: ReplyLink[] = [
  { group: "Platform", label: "All 4 priorities", campaign: "issues", dest: "/issues", snippet: "Here are Matt's four priorities:", match: ["platform", "issue", "stand", "position", "policy", "believe"] },
  { group: "Act", label: "Volunteer", campaign: "volunteer", dest: "/join", snippet: "Want to help? Sign up here:", match: ["volunteer", "help", "get involved", "sign up", "join", "door"] },
  { group: "Act", label: "Events", campaign: "events", dest: "/events", snippet: "Here are our upcoming events - RSVP:", match: ["event", "town hall", "rally", "rsvp", "meet", "when is"] },
  { group: "Act", label: "Take action", campaign: "act", dest: "/act", snippet: "Here's your campaign action plan:", match: ["action", "what can i do", "checklist"] },
  { group: "Vote", label: "How to vote", campaign: "vote", dest: "/vote", snippet: "Make your plan to vote in the Aug 4 primary:", match: ["vote", "ballot", "poll", "primary", "register"] },
  { group: "Vote", label: "Vote by mail", campaign: "absentee", dest: "/vote/absentee", snippet: "Voting by mail? Here's how:", match: ["absentee", "mail", "mail-in"] },
  { group: "Give", label: "Donate", campaign: "donate", dest: CAMPAIGN.donateUrl, snippet: "Chip in to help Matt win:", match: ["donate", "give", "contribut", "money", "chip in"] },
  { group: "More", label: "About Matt", campaign: "about", dest: "/about", snippet: "Learn more about Matt:", match: ["who is", "about", "bio", "background"] },
  { group: "More", label: "Media", campaign: "media", dest: "/media", snippet: "Videos and graphics to share:", match: ["video", "media", "watch", "share", "graphic"] },
  { group: "More", label: "Contact", campaign: "contact", dest: "/contact", snippet: "Reach the campaign here:", match: ["contact", "reach", "call", "email address"] },
];

export const REPLY_LINKS: ReplyLink[] = [...priorityLinks, ...otherLinks];
export const REPLY_GROUPS = ["Platform", "Act", "Vote", "Give", "More"] as const;

/** The UTM-tagged absolute URL for a reply link. */
export function replyLinkUrl(l: ReplyLink): string {
  return ctaLink(l.dest, l.campaign);
}

/** The full text a staffer inserts: the on-message lead + the trackable link. */
export function replyInsert(l: ReplyLink): string {
  return `${l.snippet} ${replyLinkUrl(l)}`;
}

/** Links whose keywords appear in the latest inbound text, most-relevant first — so the
 *  composer can put the right answer one tap away. Empty input -> no suggestions. */
export function suggestReplyLinks(inboundBody: string | undefined | null): ReplyLink[] {
  const hay = (inboundBody ?? "").toLowerCase();
  if (!hay.trim()) return [];
  return REPLY_LINKS.map((l) => ({ l, hits: l.match.filter((m) => hay.includes(m)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.l);
}
