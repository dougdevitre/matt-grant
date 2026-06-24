// Priority tiering for appearances. A small, TUNABLE rubric turns an event's type
// and geographic reach into a suggested Priority 1/2/3 so staff can decide fast
// where the candidate should show up — with the reasoning surfaced, and always
// overridable by hand. Thresholds/weights here are operational defaults, not
// predictions or facts; adjust as the field firms up.

import type { EventType, EventPriority } from "@/lib/events/types";

export type { EventPriority };

export const PRIORITY_LABEL: Record<EventPriority, string> = {
  1: "Priority 1 — be there",
  2: "Priority 2 — strong fit",
  3: "Priority 3 — optional",
};

// Tailwind badge classes, matching the dashboard's tier conventions.
export const PRIORITY_BADGE: Record<EventPriority, string> = {
  1: "bg-brick/15 text-brick",
  2: "bg-gold/20 text-[#9a6f1a]",
  3: "bg-field/15 text-field",
};

// High-visibility public appearances earn the most weight; internal ops (canvass,
// volunteer shifts) the least. Press-worthy formats get an earned-media bump.
const TYPE_WEIGHT: Record<EventType, number> = {
  parade: 2,
  rally: 2,
  "town-hall": 2,
  debate: 2,
  fundraiser: 1,
  "meet-greet": 1,
  canvass: 0,
  "volunteer-shift": 0,
  other: 0,
};
const EARNED_MEDIA: EventType[] = ["parade", "debate", "rally"];

// districtKey is like "district:mo-02" | "county:099" | "place:chesterfield".
function reachScore(districtKey: string): { pts: number; reason: string | null } {
  if (districtKey.startsWith("district:")) return { pts: 2, reason: "District-wide reach" };
  if (districtKey.startsWith("county:")) return { pts: 1, reason: "County-level reach" };
  return { pts: 0, reason: null };
}

export type PrioritySuggestion = { tier: EventPriority; score: number; reasons: string[] };

export function suggestPriority(input: { type: EventType; districtKey: string }): PrioritySuggestion {
  const reasons: string[] = [];
  let score = 0;

  const tw = TYPE_WEIGHT[input.type] ?? 0;
  if (tw >= 2) reasons.push("High-visibility public appearance");
  else if (tw === 1) reasons.push("Direct voter contact");
  score += tw;

  const reach = reachScore(input.districtKey ?? "");
  if (reach.reason) reasons.push(reach.reason);
  score += reach.pts;

  if (EARNED_MEDIA.includes(input.type)) {
    reasons.push("Earned-media potential");
    score += 1;
  }

  const tier: EventPriority = score >= 4 ? 1 : score >= 2 ? 2 : 3;
  if (reasons.length === 0) reasons.push("Limited reach / internal");
  return { tier, score, reasons };
}
