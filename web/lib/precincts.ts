import { PRECINCT_SOURCE } from "@/lib/geoSources";

// Shared precinct fetch + scoring used by the target-list page. Pulls the same
// live St. Louis County Aug-2024 primary layer (no geometry — lighter), derives
// real turnout, and turns it into a ranked field plan.

export type PrecinctRow = {
  name: string;
  municipality: string;
  registered: number;
  turnout: number | null; // % (Aug 2024 primary)
  expected: number; // expected primary ballots = registered * turnout
  gotv: number; // GOTV upside = registered * (1 - turnout)
};

export type ScoredRow = PrecinctRow & {
  rank: number;
  cumPct: number; // cumulative % of district expected votes (by chosen strategy)
  tier: "A" | "B" | "C";
  play: "Persuade" | "Persuade + GOTV" | "Mobilize";
};

export type Strategy = "votes" | "gotv";

function url(): string {
  const params = new URLSearchParams({
    where: PRECINCT_SOURCE.where,
    outFields: "precinct,municipality,TOTAL_CHECKINS,RV_COUNT",
    returnGeometry: "false",
    resultRecordCount: "2000",
    f: "json",
  });
  return `${PRECINCT_SOURCE.url}?${params.toString()}`;
}

export async function fetchPrecinctRows(): Promise<{ live: boolean; rows: PrecinctRow[] }> {
  try {
    const res = await fetch(url(), { next: { revalidate: 86400 } });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { features?: { attributes: Record<string, unknown> }[] };
    if (!data.features?.length) throw new Error("empty");

    const rows: PrecinctRow[] = data.features.map((f) => {
      const a = f.attributes;
      const registered = Number(a.RV_COUNT) || 0;
      const ci = a.TOTAL_CHECKINS == null ? null : Number(a.TOTAL_CHECKINS);
      const turnout = registered > 0 && ci != null ? Math.round((100 * ci) / registered) : null;
      const tFrac = turnout != null ? turnout / 100 : 0;
      return {
        name: String(a.precinct ?? "—"),
        municipality: String(a.municipality ?? "").trim(),
        registered,
        turnout,
        expected: Math.round(registered * tFrac),
        gotv: Math.round(registered * (1 - tFrac)),
      };
    });
    return { live: true, rows };
  } catch {
    return { live: false, rows: [] };
  }
}

// Rank by the chosen strategy, assign vote-coverage tiers (A=top precincts that
// together make 40% of the metric, B to 70%, C the rest) and a recommended play.
export function scoreRows(rows: PrecinctRow[], strategy: Strategy): { scored: ScoredRow[]; medianTurnout: number; totals: { expected: number; registered: number } } {
  const valid = rows.filter((r) => r.turnout != null);
  const turnouts = valid.map((r) => r.turnout as number).sort((a, b) => a - b);
  const medianTurnout = turnouts.length ? turnouts[Math.floor(turnouts.length / 2)] : 0;

  const metric = (r: PrecinctRow) => (strategy === "votes" ? r.expected : r.gotv);
  const sorted = [...rows].sort((a, b) => metric(b) - metric(a));
  const total = sorted.reduce((s, r) => s + metric(r), 0) || 1;

  let cum = 0;
  const scored: ScoredRow[] = sorted.map((r, i) => {
    cum += metric(r);
    const cumPct = Math.round((cum / total) * 100);
    const tier: ScoredRow["tier"] = cumPct <= 40 ? "A" : cumPct <= 70 ? "B" : "C";
    const t = r.turnout ?? 0;
    const play: ScoredRow["play"] =
      t >= medianTurnout + 4 ? "Persuade" : t <= medianTurnout - 4 ? "Mobilize" : "Persuade + GOTV";
    return { ...r, rank: i + 1, cumPct, tier, play };
  });

  return {
    scored,
    medianTurnout,
    totals: {
      expected: rows.reduce((s, r) => s + r.expected, 0),
      registered: rows.reduce((s, r) => s + r.registered, 0),
    },
  };
}
