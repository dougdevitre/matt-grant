// Captain score — a PURE, outcome-weighted rubric that rewards QUALITY of
// organizing, not raw volume. It runs on signals that already exist in the system
// (team roster, published events, assigned region) and is the data behind the
// scorecard (P3) and the leaderboard (P4).
//
// Guardrails baked in:
//   • Quality over volume — engagement/activation are RATES, and the event credit
//     is binary (doing the monthly in-person play, not racking up events). A captain
//     who recruits 50 names but engages none scores LOW.
//   • Opt-out safety — opted-out volunteers are excluded from the contactable
//     denominator AND every numerator, so the score never rewards (or requires)
//     contacting someone who opted out. (Counts computed in score-data.ts.)
//
// The function takes pre-computed counts only, so it's deterministic and testable
// (no Date/DB). The data layer (score-data.ts) derives the counts.

export type CaptainSignals = {
  rosterSize: number; // non-removed volunteers assigned to this captain (span basis)
  contactable: number; // roster minus opted-out (rate denominator)
  activated: number; // contactable volunteers at ACTIVE status
  engaged: number; // contactable volunteers who've been welcomed/contacted or raised a hand
  recentEvents: number; // PUBLISHED events this captain owns within the scoring window
  hasRegion: boolean; // assigned at least one Geo Hierarchy region
};

export type ComponentKey = "span" | "engaged" | "activated" | "events" | "region";

export type ScoreComponent = {
  key: ComponentKey;
  label: string;
  score: number; // 0–100
  weight: number; // 0–1, weights sum to 1
  detail: string; // honest, human description of what was measured
};

export type Tier = "new" | "needs-attention" | "building" | "strong" | "excellent";

export type CaptainScore = {
  total: number; // 0–100 weighted
  tier: Tier;
  components: ScoreComponent[];
  weakest: ComponentKey | null; // lowest-scoring component → next best action
  hasActivity: boolean; // false for a brand-new captain (no team, no events, no region)
};

// Span-of-control target — a team small enough for real relationships (matches the
// captain guide / coverage map).
export const SPAN_MIN = 5;
export const SPAN_MAX = 10;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const rate = (num: number, den: number) => (den > 0 ? clamp((num / den) * 100) : 0);

// Span score: peaks across the healthy 5–10 band, ramps up below it, and eases
// down (never to zero) for an over-span team that should be split.
export function spanScore(rosterSize: number): number {
  if (rosterSize <= 0) return 0;
  if (rosterSize < SPAN_MIN) return clamp((rosterSize / SPAN_MIN) * 100); // 1→20 … 4→80
  if (rosterSize <= SPAN_MAX) return 100;
  return Math.max(40, clamp(100 - (rosterSize - SPAN_MAX) * 10)); // 11→90 … 16→40, floor 40
}

const WEIGHTS: Record<ComponentKey, number> = {
  engaged: 0.3, // nobody left cold — the welcome/debrief plays (biggest)
  activated: 0.25, // volunteers actually working
  span: 0.2, // right-sized team
  events: 0.15, // monthly in-person touch
  region: 0.1, // plugged into a coverage area
};

const tierOf = (total: number, hasActivity: boolean): Tier => {
  if (!hasActivity) return "new";
  if (total >= 85) return "excellent";
  if (total >= 70) return "strong";
  if (total >= 50) return "building";
  return "needs-attention";
};

export const TIER_LABEL: Record<Tier, string> = {
  new: "Just getting started",
  "needs-attention": "Needs attention",
  building: "Building",
  strong: "Strong",
  excellent: "Excellent",
};

/** Compute a captain's score + per-component breakdown from pre-derived signals. */
export function scoreCaptain(s: CaptainSignals): CaptainScore {
  const engaged = rate(s.engaged, s.contactable);
  const activated = rate(s.activated, s.contactable);
  const span = spanScore(s.rosterSize);
  const events = s.recentEvents >= 1 ? 100 : 0;
  const region = s.hasRegion ? 100 : 0;

  const components: ScoreComponent[] = [
    {
      key: "engaged",
      label: "Volunteers engaged",
      score: engaged,
      weight: WEIGHTS.engaged,
      detail:
        s.contactable > 0
          ? `${s.engaged} of ${s.contactable} contactable volunteers welcomed, contacted, or raised a hand`
          : "No contactable volunteers on your team yet",
    },
    {
      key: "activated",
      label: "Volunteers active",
      score: activated,
      weight: WEIGHTS.activated,
      detail:
        s.contactable > 0
          ? `${s.activated} of ${s.contactable} contactable volunteers are working (Active)`
          : "No contactable volunteers on your team yet",
    },
    {
      key: "span",
      label: "Team size",
      score: span,
      weight: WEIGHTS.span,
      detail:
        s.rosterSize === 0
          ? "No volunteers on your team yet"
          : s.rosterSize > SPAN_MAX
            ? `${s.rosterSize} volunteers — over ${SPAN_MAX}; promote and split`
            : `${s.rosterSize} volunteers — healthy span (${SPAN_MIN}–${SPAN_MAX})`,
    },
    {
      key: "events",
      label: "In-person event",
      score: events,
      weight: WEIGHTS.events,
      detail: s.recentEvents >= 1 ? `${s.recentEvents} published event(s) you own recently` : "No recent published event you own",
    },
    {
      key: "region",
      label: "Region assigned",
      score: region,
      weight: WEIGHTS.region,
      detail: s.hasRegion ? "Assigned to a coverage region" : "No region assigned yet",
    },
  ];

  const total = clamp(components.reduce((sum, c) => sum + c.score * c.weight, 0));
  const hasActivity = s.rosterSize > 0 || s.recentEvents > 0 || s.hasRegion;

  // Weakest actionable component (lowest score; tie-break by higher weight so the
  // most impactful fix surfaces first). Null when nothing's been started.
  const weakest = hasActivity
    ? [...components].sort((a, b) => a.score - b.score || b.weight - a.weight)[0].key
    : null;

  return { total, tier: tierOf(total, hasActivity), components, weakest, hasActivity };
}

// The single next best action tied to the weakest component — a concrete step that
// links into a real dashboard surface (kept honest, no invented features).
export const NEXT_ACTION: Record<ComponentKey, { text: string; href: string; where: string }> = {
  engaged: {
    text: "Welcome and check in with every volunteer — no one left cold.",
    href: "/dashboard/volunteers",
    where: "Volunteers board",
  },
  activated: {
    text: "Help volunteers take their first real action so they move to Active.",
    href: "/dashboard/playbook",
    where: "Captain playbook",
  },
  span: {
    text: "Recruit toward a 5–10 team — or if you're over 10, promote a volunteer and split.",
    href: "/dashboard/coverage",
    where: "Coverage map",
  },
  events: {
    text: "Put one in-person event on the calendar this month and bring your team.",
    href: "/dashboard/events",
    where: "Events",
  },
  region: {
    text: "Ask an admin to assign your coverage region so volunteers match to you.",
    href: "/dashboard/team",
    where: "Team page",
  },
};
