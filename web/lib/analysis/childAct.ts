// Family-court / CHILD Protection Act relevance classifier.
//
// Implements the flagship synthesis step from candidate/issues-to-action-data-
// synthesis-plan.md §3.1: take the PUBLIC legislative record already ingested from
// Congress.gov and surface the bills that touch Matt's #1 priority — corruption in
// the family court system — and the CHILD Act's stated lever, Title IV-D federal
// grant money tied to state family-court compliance (candidate/platform.md).
//
// This is a deterministic keyword classifier, mirroring lib/analysis/alignment.ts:
// it only READS public bill text (title + policy area) and reports which terms it
// matched. It asserts nothing beyond the bill's own title, infers no intent, and
// invents no positions — a bill with no matched term scores 0 and is dropped.

export type RelevanceTier = "core" | "related" | "tangential";

export type BillRelevance = {
  score: number;
  tier: RelevanceTier | null; // null when nothing matched (score 0)
  matched: string[]; // the exact terms found, for transparent display/citation
};

// Term groups, weighted by how directly they bear on the family-court fight and
// the CHILD Act's Title IV-D mechanism. Terms are matched as whole tokens
// (separators flexible, so "Title IV-D", "Title IV–D", "title iv d" all hit).
const TERM_WEIGHTS: ReadonlyArray<readonly [term: string, weight: number]> = [
  // Core — the CHILD Act lever and the family-court system itself.
  ["title iv-d", 3],
  ["iv-d", 3],
  ["child support enforcement", 3],
  ["child support", 3],
  ["family court", 3],
  ["family courts", 3],
  ["domestic relations", 3],
  ["child custody", 3],
  ["custody", 3],
  ["guardian ad litem", 3],
  ["parental rights", 3],
  ["parenting time", 3],
  // Related — child welfare/protection adjacent to the cause.
  ["child welfare", 2],
  ["child protection", 2],
  ["child protective", 2],
  ["child abuse", 2],
  ["child safety", 2],
  ["foster care", 2],
  ["child victims", 2],
  // Tangential — general children/family framing; weak signal on its own.
  ["children", 1],
  ["child", 1],
  ["minor", 1],
  ["juvenile", 1],
  ["families", 1],
];

function tierFor(score: number): RelevanceTier | null {
  if (score >= 3) return "core";
  if (score >= 2) return "related";
  if (score >= 1) return "tangential";
  return null;
}

// Build a boundary-aware matcher for a term: separators inside the term
// (spaces/hyphens) match any run of space or hyphen, and the term must sit on
// non-alphanumeric boundaries so "child" doesn't fire inside "Childersburg".
function termRegex(term: string): RegExp {
  const escaped = term
    .split(/[\s-]+/)
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s-]+");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
}

const MATCHERS = TERM_WEIGHTS.map(([term, weight]) => ({ term, weight, re: termRegex(term) }));

// Avoid double-counting a longer phrase and the shorter token it contains
// (e.g. "child support" already implies "child"): once a term matches, suppress
// any later term that is a substring of one already matched.
export function scoreText(title?: string | null, policyArea?: string | null): BillRelevance {
  const hay = `${title ?? ""} ${policyArea ?? ""}`.toLowerCase();
  const matched: string[] = [];
  let score = 0;

  for (const m of MATCHERS) {
    if (!m.re.test(hay)) continue;
    if (matched.some((t) => t.includes(m.term))) continue; // contained in a broader hit
    matched.push(m.term);
    score += m.weight;
  }

  return { score, tier: tierFor(score), matched };
}

// Minimal shape this classifier needs from a stored bill record. Compatible with
// lib/integrations/legislative/store.ts BillRecord (which carries more fields).
export type ClassifiableBill = {
  title?: string | null;
  policyArea?: string | null;
  sourceUrl?: string | null;
};

export type RankedBill<T extends ClassifiableBill> = T & { relevance: BillRelevance };

// Rank a set of bills by family-court relevance. Drops zero-score bills, and —
// per the plan's "no source, no claim" rule — drops anything without a citation
// (sourceUrl). Stable sort: score desc, then leaves input order for ties.
export function rankByFamilyCourtRelevance<T extends ClassifiableBill>(bills: T[]): RankedBill<T>[] {
  return bills
    .map((b) => ({ ...b, relevance: scoreText(b.title, b.policyArea) }))
    .filter((b) => b.relevance.score > 0 && !!b.sourceUrl)
    .sort((a, b) => b.relevance.score - a.relevance.score);
}
