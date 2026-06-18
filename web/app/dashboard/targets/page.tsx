import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { TargetTable } from "@/components/dashboard/TargetTable";
import { fetchPrecinctRows } from "@/lib/precincts";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const { live, rows } = await fetchPrecinctRows();

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
        <TargetTable rows={rows} />
      )}

      <p className="mt-6 text-xs text-slate">
        Expected ballots = registered × turnout. GOTV upside = registered × (1 − turnout). Tiers cover
        cumulative share of the chosen metric (A→40%, B→70%, C rest). &ldquo;Play&rdquo; compares each precinct to
        the district median. Turnout is Aug 2024 primary (illustrative of Aug 4 2026); verify before use.
      </p>
    </>
  );
}
