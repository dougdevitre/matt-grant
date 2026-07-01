// Local Issue Intersection — Layer B output guards. Phase-4 safety net, built
// AHEAD of the AI layer so generation can only ship behind it (SPEC §8).
//
// These are a deterministic BACKSTOP to the system prompt, not a replacement: the
// prompt is the primary control (SPEC §7). checkLocalResponse rejects a generated
// paragraph that (a) contains a number not traceable to the snapshot / documented
// text, (b) names a local official/court/school-code/ballot measure, or (c) couples
// Matt with a NEW position tied to a local specific. Anything rejected → the caller
// falls back to curated, human-authored content (never ships the bad output).
import { CAMPAIGN } from "@/lib/site";

export type GuardSnapshot = { place: string; figures: Record<string, string>; citations?: string[] } | null;

export type GuardCtx = {
  snapshot: GuardSnapshot;
  documentedText: string; // issue commitment + argument + signature body
};

export type Violation = "invented-figure" | "foreign-locality" | "undocumented-position";

export type GuardResult = { ok: boolean; violations: Violation[]; detail: string[] };

// Numeric tokens, KEEPING a magnitude word so a fabricated "$4 million" (→ "4million")
// can't match a bare allowed "4" (e.g. "August 4"). "$78,000" → "78000", "22%" → "22".
function digitGroups(s: string): string[] {
  return (s.match(/\d[\d,.]*(?:\s*(?:million|billion|thousand))?/gi) ?? [])
    .map((g) => g.toLowerCase().replace(/[,.\s]/g, "").replace(/^0+(?=\d)/, ""))
    .filter(Boolean);
}

// Local institutions/measures the AI must never introduce (SPEC §5). Deterministic
// patterns tuned to the SPEC's forbidden examples + common leakage shapes.
const LOCALITY_PATTERNS: RegExp[] = [
  /\bJudge\s+[A-Z]\w*/, // "Judge Smith"
  /\bR-(?:\d+|[IVX]+)\b/, // MO school-district codes: "R-7", "R-II"
  /\bProp(?:osition)?\.?\s+[A-Z0-9]+\b/i, // "Proposition A", "Prop 1"
];

// Matt + a position verb + a LOCAL object = a commitment he hasn't documented.
// Position verbs tied to documented platform ("support term limits") are fine, so
// this only fires when a local object is present.
const POSITION_PATTERN =
  /\bMatt\b[^.]{0,60}\b(?:oppos\w+|support\w+|reject\w+|urg\w+|increase\w*|cut\w*|challeng\w+|fund\w*)\b[^.]{0,60}\b(?:proposition|prop\b|bond|levy|budget|district|ordinance|measure|funding)\b/i;

export function checkLocalResponse(text: string, ctx: GuardCtx): GuardResult {
  const violations: Violation[] = [];
  const detail: string[] = [];

  // (a) invented figures — every number in the text must trace to an allowed source.
  const allowed = new Set<string>([
    ...digitGroups(ctx.documentedText),
    ...(ctx.snapshot ? Object.values(ctx.snapshot.figures).flatMap(digitGroups) : []),
    ...(ctx.snapshot?.citations ?? []).flatMap(digitGroups),
    ...digitGroups(`${CAMPAIGN.electionLabel} ${CAMPAIGN.districtShort} ${CAMPAIGN.district}`),
  ]);
  for (const n of digitGroups(text)) {
    if (!allowed.has(n)) {
      violations.push("invented-figure");
      detail.push(`figure "${n}" not in snapshot/documented text`);
      break;
    }
  }

  // (b) foreign locality — named local official/court/school/measure.
  for (const re of LOCALITY_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push("foreign-locality");
      detail.push(`local specific "${m[0].trim()}"`);
      break;
    }
  }

  // (c) undocumented local position.
  const pm = text.match(POSITION_PATTERN);
  if (pm) {
    violations.push("undocumented-position");
    detail.push(`position tied to a local specific: "${pm[0].trim()}"`);
  }

  return { ok: violations.length === 0, violations, detail };
}
