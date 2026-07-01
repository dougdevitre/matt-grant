// Local Issue Intersection — Layer A (deterministic, cited data). Phase 1.
//
// Given an issue + a ZIP, assemble a "local snapshot": a small set of VERIFIED,
// SOURCED public figures relevant to that issue, drawn from the app's existing
// ZIP-level Census ACS integration (lib/integrations/census/places.ts). This layer
// never invents a value and never generates prose — it only selects real figures
// and attaches their citation. See web/docs/local-intersection/SPEC.md.
//
// What this layer must NOT do (SPEC §2/§5): estimate/interpolate figures, name a
// local official/school/court/budget, or map anything to a position. Layer B (the
// AI response, a later phase) consumes this snapshot as cited context.
import { fetchZctaAcs, type ZctaAcs } from "@/lib/integrations/census/places";

// A single cited figure. `value` is display-ready; `source`/`sourceUrl` are the
// mandatory citation (SPEC §3 — every figure shows its source).
export type LocalFact = {
  key: string;
  label: string;
  value: string;
  source: string;
  sourceUrl: string;
};

export type LocalSnapshot = {
  zip: string;
  place: string; // e.g. "ZIP 63131" — the verified identity of the data
  facts: LocalFact[];
};

const ACS_SOURCE = "U.S. Census ACS 5-year (2023)";

// US 5-digit ZIP only; anything else → null. Same rule as engine.toZip / profile.
export function toZip(raw: unknown): string | null {
  return (String(raw ?? "").trim().match(/^\d{5}/) ?? [])[0] ?? null;
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;
const count = (n: number): string => Math.round(n).toLocaleString("en-US");

// Which Census figures each issue may surface, per SPEC §4. Pure + testable: takes
// an already-fetched ZctaAcs and returns the allowed, cited facts — no network, no
// invention. A figure the Census response left null is simply omitted (never faked).
//
// Deliberate honesty (SPEC §4):
//  - term-limits is a FEDERAL structural reform with no honest local-data hook, so
//    it surfaces NO figure — the widget falls back to generic framing.
//  - family-courts' most on-point fact (% households with children) is NOT in the
//    current Census variable set, so it uses population as civic context until that
//    variable (ACS B11005) is wired.
export function selectFacts(issueSlug: string, acs: ZctaAcs): LocalFact[] {
  const cite = { source: ACS_SOURCE, sourceUrl: acs.sourceUrl };
  const pop = (): LocalFact[] =>
    acs.population != null ? [{ key: "population", label: "Population", value: count(acs.population), ...cite }] : [];
  const income = (): LocalFact[] =>
    acs.medianHouseholdIncome != null
      ? [{ key: "medianHouseholdIncome", label: "Median household income", value: usd(acs.medianHouseholdIncome), ...cite }]
      : [];
  const homeValue = (): LocalFact[] =>
    acs.medianHomeValue != null
      ? [{ key: "medianHomeValue", label: "Median home value", value: usd(acs.medianHomeValue), ...cite }]
      : [];

  switch (issueSlug) {
    case "family-courts":
      // Children-first civic context. (Households-with-children pending ACS B11005.)
      return pop();
    case "lower-taxes":
      return [...income(), ...homeValue()];
    case "smaller-government":
      return pop();
    case "term-limits":
    default:
      // No honest local hook — surface nothing; do not manufacture relevance.
      return [];
  }
}

// Build the snapshot for an issue + raw ZIP. Deterministic + fail-closed: returns
// null on an invalid ZIP, a Census error, or an issue with no local hook — the
// caller then degrades to generic framing (never fabricates). No AI.
export async function buildLocalSnapshot(issueSlug: string, rawZip: unknown): Promise<LocalSnapshot | null> {
  const zip = toZip(rawZip);
  if (!zip) return null;
  try {
    const [acs] = await fetchZctaAcs([zip]);
    if (!acs) return null;
    const facts = selectFacts(issueSlug, acs);
    if (!facts.length) return null;
    return { zip, place: `ZIP ${zip}`, facts };
  } catch {
    return null; // Census down / bad response — degrade, never throw.
  }
}
