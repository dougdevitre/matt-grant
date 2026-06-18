// Personalized supporter action plans. A deterministic generator (no Date.now /
// Math.random — stable for React purity + reproducible prints) that adjusts the
// branded action items by the supporter's area and the issue they back, all
// oriented toward awareness and turnout for the August 4 primary.
import { ISSUES, getIssue } from "@/lib/issues";

export type Cadence = "daily" | "weekly";
export type ActionItem = { text: string; tag: string; href?: string };
export type AgendaDay = { label: string; theme: string; items: ActionItem[] };
export type Agenda = { area: string; issueSlug: string; issueTitle: string; cadence: Cadence; days: AgendaDay[] };

// Common MO-02 areas as quick-picks (free text also allowed). Confirm your
// district at the official voter lookup.
export const AREA_SUGGESTIONS = [
  "Chesterfield", "Wildwood", "Ballwin", "Ellisville", "Eureka", "Town and Country",
  "Kirkwood", "Des Peres", "Manchester", "Jefferson County", "your neighborhood",
];

// Fill {area}/{issue}/{tag}/{n} in an action template.
function fill(t: string, ctx: { area: string; issue: string; tag: string; n: number }) {
  return t
    .replace(/{area}/g, ctx.area)
    .replace(/{issue}/g, ctx.issue.toLowerCase())
    .replace(/{tag}/g, ctx.tag.toLowerCase())
    .replace(/{n}/g, String(ctx.n));
}

// Themed building blocks; each day pulls a couple. Faithful to the platform —
// no fabricated facts, just organizing actions toward the vote.
const READY: string[] = [
  "Confirm you're registered and know your polling place for August 4.",
  "Add the primary — August 4, 2026 — to your calendar with a reminder.",
];
const LEARN = (slug: string): ActionItem[] => [
  { text: "Read Matt's argument on {issue} so you can speak to it.", tag: "Learn", href: `/issues/${slug}` },
  { text: "Watch the short {issue} video and note one line that resonates.", tag: "Learn", href: `/issues/${slug}` },
];
const SHARE: ActionItem[] = [
  { text: "Share the {issue} graphic from the media library.", tag: "Share", href: "/media" },
  { text: "Post in your own words why {tag} matters to your family.", tag: "Share" },
  { text: "Forward a Matt Grant email to one friend in {area}.", tag: "Share" },
];
const TALK: string[] = [
  "Have one conversation about {issue} with someone in {area}.",
  "Bring up {tag} at a family or community gathering this week.",
  "Tell {n} neighbors in {area} that Matt Grant is on the ballot August 4.",
];
const RECRUIT: ActionItem[] = [
  { text: "Invite one person from {area} to volunteer with the campaign.", tag: "Recruit", href: "/contact" },
  { text: "Find {n} households in {area} who share Matt's values.", tag: "Recruit" },
];
const MATERIALS: ActionItem[] = [
  { text: "Print a yard sign or palm card and put it up in {area}.", tag: "Materials", href: "/media" },
  { text: "Hand a flyer about {issue} to a neighbor in {area}.", tag: "Materials", href: "/media" },
];
const GOTV: string[] = [
  "Ask {n} friends in {area} to commit, out loud, to voting August 4.",
  "Offer a neighbor in {area} a ride or a reminder for election day.",
  "Text {n} people: “Matt Grant — vote August 4. Will you be there?”",
];

const t = (s: string, tag: string, href?: string): ActionItem => ({ text: s, tag, href });

export function buildAgenda(areaInput: string, issueSlug: string, cadence: Cadence): Agenda {
  const issue = getIssue(issueSlug) ?? ISSUES[0];
  const area = (areaInput || "your area").trim();
  const ctx = { area, issue: issue.eyebrow, tag: issue.eyebrow, n: 3 };
  const F = (s: string, tag: string, href?: string) => t(fill(s, ctx), tag, href);
  const FI = (a: ActionItem): ActionItem => ({ ...a, text: fill(a.text, ctx) });

  // Rotate sub-selections by issue index so different issues yield different mixes.
  const k = ISSUES.findIndex((i) => i.slug === issue.slug);
  const pick = <T,>(arr: T[], i: number) => arr[((i % arr.length) + arr.length) % arr.length];

  if (cadence === "daily") {
    return {
      area, issueSlug: issue.slug, issueTitle: issue.title, cadence,
      days: [
        {
          label: "Today", theme: `Move the needle on ${issue.eyebrow.toLowerCase()}`,
          items: [
            F(pick(READY, k), "Be ready"),
            FI(pick(LEARN(issue.slug), k)),
            FI(pick(SHARE, k)),
            F(pick(TALK, k), "Talk"),
            F(pick(GOTV, k), "Turn out the vote"),
          ],
        },
      ],
    };
  }

  // weekly: a 7-day arc toward the vote
  const days: AgendaDay[] = [
    { label: "Day 1", theme: "Get ready", items: [F(READY[0], "Be ready"), F(READY[1], "Be ready")] },
    { label: "Day 2", theme: `Learn ${issue.eyebrow}`, items: LEARN(issue.slug).map(FI) },
    { label: "Day 3", theme: "Share the message", items: [FI(SHARE[0]), FI(SHARE[1])] },
    { label: "Day 4", theme: "Start conversations", items: [F(TALK[0], "Talk"), F(TALK[2], "Talk")] },
    { label: "Day 5", theme: "Grow the team", items: RECRUIT.map(FI) },
    { label: "Day 6", theme: "Put up materials", items: MATERIALS.map(FI) },
    { label: "Day 7", theme: "Turn out the vote", items: [F(GOTV[0], "GOTV"), F(GOTV[2], "GOTV")] },
  ];
  return { area, issueSlug: issue.slug, issueTitle: issue.title, cadence, days };
}
