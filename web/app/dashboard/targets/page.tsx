import { PageHeader } from "@/components/dashboard/Notice";
import { TargetTable } from "@/components/dashboard/TargetTable";
import { fetchPrecinctRows } from "@/lib/precincts";

export const dynamic = "force-dynamic";

export default async function TargetsPage() {
  const { live, rows } = await fetchPrecinctRows();

  return (
    <>
      <PageHeader kicker="Field plan" title="Precinct targets" />

      <p className="mb-5 max-w-prose text-sm text-slate">
        Auto-ranked from live St. Louis County data — real <strong>Aug-2024 primary turnout</strong>{" "}
        and registered voters per MO-02 precinct. Switch strategy to chase where the votes already
        are (persuasion) or where turnout lags (mobilization), then export a walk list.
      </p>

      {!live || rows.length === 0 ? (
        <div className="card p-8 text-center text-slate">
          Couldn't reach the county precinct feed right now. The ranking comes from the same source as
          the 3D map — try again shortly.
        </div>
      ) : (
        <TargetTable rows={rows} />
      )}

      <p className="mt-6 text-xs text-slate">
        Expected ballots = registered × turnout. GOTV upside = registered × (1 − turnout). Tiers cover
        cumulative share of the chosen metric (A→40%, B→70%, C rest). "Play" compares each precinct to
        the district median. Turnout is Aug 2024 primary (illustrative of Aug 4 2026); verify before use.
      </p>
    </>
  );
}
