import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { TargetTable, type VoterJoin } from "@/components/dashboard/TargetTable";
import { fetchPrecinctRows } from "@/lib/precincts";
import { requireCap } from "@/lib/auth";
import { enrichmentByMapName } from "@/lib/voters/enrich";
import { listVoterAggs } from "@/lib/voters/store";

export const dynamic = "force-dynamic";

// Best-effort voter-file join (voter-file-plan.md Phase 3): per-precinct
// PERSUADE universe + heuristic primary propensity from the VOTERAGG rollups,
// keyed by the table's precinct names via the crosswalk. Pre-ingest (or on any
// store error) this returns undefined and the table renders exactly as before.
async function voterJoinFor(names: string[]): Promise<VoterJoin | undefined> {
  try {
    const aggs = await listVoterAggs();
    if (!aggs.length) return undefined;
    const { byName } = enrichmentByMapName(aggs, names);
    if (!byName.size) return undefined;
    const join: VoterJoin = {};
    for (const [name, e] of byName) join[name] = { persuade: e.persuade, vPropensity: e.vPropensity };
    return join;
  } catch {
    return undefined;
  }
}

export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ precinct?: string }> }) {
  await requireCap("viewTargets");
  const { precinct } = await searchParams;
  const { live, rows } = await fetchPrecinctRows();
  const voter = await voterJoinFor(rows.map((r) => r.name));

  return (
    <>
      <PageHeader kicker="Field plan" title="Precinct targets" />

      <HowTo
        steps={[
          "Precincts are auto-ranked from live county data — read the table top-down for your highest-value targets.",
          "Switch strategy to match your goal: persuasion (chase where the votes already are) or mobilization (where turnout lags).",
          "Read the tiers — A covers the top 40% of the chosen metric, B the next 30%, C the rest.",
          "Use the “Play” column to see how each precinct compares to the district median.",
          "Export a walk list to hand to canvass teams; turnout is Aug-2024 primary, so verify before acting.",
        ]}
      />

      <p className="mb-5 max-w-prose text-sm text-slate">
        Auto-ranked from live St. Louis County data. Precincts are scoped to the{" "}
        <strong>2025 enacted MO-02 map</strong> (county field <span className="font-mono">congress25</span>);
        turnout is the real <strong>Aug-2024 primary</strong> (check-ins ÷ registered), joined by precinct.
        <strong> Covers the St. Louis County portion of MO-02 only</strong> — the added rural counties need
        their own feeds (see the data plan). Switch strategy to chase where the votes already are
        (persuasion) or where turnout lags (mobilization), then export a walk list.
      </p>

      {!live || rows.length === 0 ? (
        <div className="card p-8 text-center text-slate">
          Couldn&apos;t reach the county precinct feed right now. The ranking comes from the same source as
          the 3D map — try again shortly.
        </div>
      ) : (
        <TargetTable rows={rows} highlight={precinct} voter={voter} />
      )}

      <p className="mt-6 text-xs text-slate">
        Expected ballots = registered × turnout. GOTV upside = registered × (1 − turnout). Tiers cover
        cumulative share of the chosen metric (A→40%, B→70%, C rest). &ldquo;Play&rdquo; compares each precinct to
        the district median. Turnout is Aug 2024 primary (illustrative of Aug 4 2026); verify before use.
      </p>
      {voter && (
        <p className="mt-2 text-xs text-slate">
          Persuade = habitual voters with unknown lean in the ingested voter file (the doors-and-mail
          universe). Prim. prop. = heuristic expected-primary share from participation recency —
          labeled heuristic, see <span className="font-mono">candidate/voter-file-plan.md</span> §4.
          Precincts without a crosswalk match show &ldquo;—&rdquo;.
        </p>
      )}
    </>
  );
}
