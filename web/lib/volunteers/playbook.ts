// Captain playbook — the canonical operating protocol a captain runs, organized by
// cadence, mode (online / in-person / both), and where in the dashboard each play
// is done. PURE + code-defined on purpose: every play maps to a real, existing
// dashboard feature (no aspirational steps), and it's the stable backbone the
// captain score (P3) keys off. Scope splits team-wide duties from per-region ones.
import type { Region } from "@/lib/volunteers/regions";

export type Cadence = "weekly" | "biweekly" | "monthly" | "as-needed";
export type Mode = "online" | "in-person" | "both";
export type PlayScope = "team" | "region";

export type Play = {
  id: string;
  title: string;
  cadence: Cadence;
  mode: Mode;
  scope: PlayScope;
  how: string; // short, honest how-to
  where: string; // dashboard location label
  href: string; // a real dashboard route the captain can reach
};

// Cadence sort order (most frequent first) — used by the builder and the UI.
export const CADENCE_ORDER: Cadence[] = ["weekly", "biweekly", "monthly", "as-needed"];
const cadenceRank = (c: Cadence) => CADENCE_ORDER.indexOf(c);

export const CADENCE_LABEL: Record<Cadence, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  "as-needed": "As needed",
};

export const MODE_LABEL: Record<Mode, string> = {
  online: "Online",
  "in-person": "In person",
  both: "Online or in person",
};

// The plays. Each one is something a captain can do TODAY in the dashboard.
export const CAPTAIN_PLAYS: Play[] = [
  {
    id: "welcome-new-volunteers",
    title: "Welcome every new volunteer within 48 hours",
    cadence: "weekly",
    mode: "both",
    scope: "team",
    how: "Greet each new join, learn what they want to do, and point them to their first action. A fast, warm welcome is the single biggest driver of whether someone stays.",
    where: "Volunteers board",
    href: "/dashboard/volunteers",
  },
  {
    id: "check-team-size",
    title: "Check your team size and coverage",
    cadence: "weekly",
    mode: "online",
    scope: "team",
    how: "Keep your team in the 5–10 range. As you approach 10, plan to promote a strong Core volunteer to captain and split your turf so both teams return to a healthy size.",
    where: "Coverage map",
    href: "/dashboard/coverage",
  },
  {
    id: "confirm-and-debrief",
    title: "Confirm volunteers and debrief results",
    cadence: "weekly",
    mode: "both",
    scope: "team",
    how: "Confirm who's working which shift, then follow up so results get logged. Volunteers do more when someone notices they showed up.",
    where: "Volunteers board",
    href: "/dashboard/volunteers",
  },
  {
    id: "work-turf-lists",
    title: "Claim and assign turf and call lists; keep statuses current",
    cadence: "weekly",
    mode: "both",
    scope: "region",
    how: "Cut your region into walkable turf and callable lists, assign them to volunteers, and update each one's status as it's worked so nothing is double-covered or dropped.",
    where: "Turf & call lists",
    href: "/dashboard/field-assignments",
  },
  {
    id: "host-local-event",
    title: "Host or staff a local event",
    cadence: "monthly",
    mode: "in-person",
    scope: "region",
    how: "Put at least one in-person touch on the calendar in your region each month — a canvass launch, a house party, a literature drop — and bring your team.",
    where: "Events",
    href: "/dashboard/events",
  },
  {
    id: "recruit-to-fill-gaps",
    title: "Recruit to fill coverage gaps",
    cadence: "biweekly",
    mode: "both",
    scope: "region",
    how: "If your region is thin or flagged as a gap, ask each volunteer to bring one neighbor. This race is won one neighbor at a time.",
    where: "Coverage map",
    href: "/dashboard/coverage",
  },
];

export type PlaybookRegionSection = { region: Region; plays: Play[] };
export type Playbook = {
  team: Play[]; // team-wide plays, run once regardless of region
  byRegion: PlaybookRegionSection[]; // region plays, per assigned region
  regionPlays: Play[]; // the region-scoped plays themselves (for the no-region template view)
  hasRegions: boolean;
};

const byCadenceThenTitle = (a: Play, b: Play) =>
  cadenceRank(a.cadence) - cadenceRank(b.cadence) || a.title.localeCompare(b.title);

/**
 * Build a captain's playbook. Team plays come back once; region plays are attached
 * to each assigned region. PURE and deterministic (sorted by cadence then title);
 * no Date/random. `regions` is the captain's assigned regions (empty for an
 * unassigned captain or an admin previewing).
 */
export function buildPlaybook(regions: Region[], plays: Play[] = CAPTAIN_PLAYS): Playbook {
  const team = plays.filter((p) => p.scope === "team").sort(byCadenceThenTitle);
  const regionPlays = plays.filter((p) => p.scope === "region").sort(byCadenceThenTitle);
  const byRegion = regions.map((region) => ({ region, plays: regionPlays }));
  return { team, byRegion, regionPlays, hasRegions: regions.length > 0 };
}
