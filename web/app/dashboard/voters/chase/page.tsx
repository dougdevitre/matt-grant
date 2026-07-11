import { redirect } from "next/navigation";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { PrintButton } from "@/components/dashboard/PrintButton";
import { ReturnsImport } from "@/components/dashboard/ReturnsImport";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { dbConfigured } from "@/lib/db";
import { chaseReport, CHASE_TIERS } from "@/lib/voters/chase";
import { RSMO_NOTICE } from "@/lib/voters/dashboard";
import { listBallotAggs } from "@/lib/voters/returnsStore";
import { listVoterAggs } from "@/lib/voters/store";

export const dynamic = "force-dynamic";

const num = (n: number) => n.toLocaleString("en-US");

// The ballot-chase board (voter-file-plan.md Phase 5): the Daily Chase Report
// from tactics/ballot-chase-program.md, computed live — tier universes from the
// VOTERAGG rollups (they MOVE as canvass IDs land), banked ballots from the
// imported county returns. ADMIN-ONLY (viewVoterFile — RSMo 115.157 data).
export default async function ChasePage() {
  const { role } = await staffGate();
  if (!can(role, "viewVoterFile")) redirect("/dashboard?denied=voters");

  const [aggs, ballotAggs] = await Promise.all([listVoterAggs(), listBallotAggs()]);
  const report = chaseReport(aggs, ballotAggs);
  const hasTiers = aggs.some((a) => a.tiers);
  const asOf = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <PageHeader kicker="Field" title="Ballot chase" />

      <p className="mt-2 max-w-3xl rounded-sm border border-brick/30 bg-brick/5 px-4 py-2 text-[0.75rem] leading-relaxed text-ink no-print">
        {RSMO_NOTICE}
      </p>

      <HowTo
        steps={[
          "Early voting runs Jul 21 - Aug 3; Election Day is Aug 4. Each day, paste the county's returns export below — only new voter ids bank (re-importing a cumulative file never double-counts).",
          "Tiers follow tactics/ballot-chase-program.md: 1 Chase Hard (supporters who rarely vote — this tier decides the race), 2 Chase Firm, 3 Chase Light, 4 Persuasion GOTV. Opponents and unknown-unlikely voters are never chased.",
          "Universe numbers move as canvass IDs come back (Voter database → drill-down): every new supporter ID grows the chase universes — that's the learning loop working.",
          "Banked voters should come OFF walk/call lists — regenerate packets after each import. Print this page for the daily field huddle.",
        ]}
      />

      {!dbConfigured && <DbNotice />}

      {aggs.length === 0 ? (
        <div className="mt-6 card p-6">
          <p className="font-display text-lg text-ink">No voter data yet</p>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            The chase board lights up after the voter-file ingest (Field → Voter database has the runbook).
          </p>
        </div>
      ) : (
        <div className="printable">
          <div className="mt-4 flex items-center gap-3 no-print">
            <PrintButton className="btn-ghost px-3 py-1 text-xs">Print daily report</PrintButton>
            {!hasTiers && (
              <p className="text-xs text-brick">
                Tier universes need a re-ingest with the Phase-5 script (the current rollups predate tier counts).
              </p>
            )}
          </div>

          <p className="mt-3 hidden font-mono text-[0.65rem] uppercase tracking-eyebrow print:block">
            Matt Grant for Congress · Daily Chase Report · {asOf} · internal
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="card p-4">
              <p className="font-display text-2xl text-ink">{num(report.universe)}</p>
              <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">Chase universe (Tiers 1-4)</p>
            </div>
            <div className="card p-4">
              <p className="font-display text-2xl text-field">{num(report.banked)}</p>
              <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">
                Banked · {report.pctComplete}% complete
              </p>
            </div>
            <div className="card p-4">
              <p className="font-display text-2xl text-brick">{num(report.outstanding)}</p>
              <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">Outstanding</p>
            </div>
            <div className="card p-4">
              <p className="font-display text-2xl text-ink">{num(report.bankedAll)}</p>
              <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">All returns (incl. non-chase)</p>
            </div>
          </div>

          <div className="mt-4 card overflow-hidden p-0">
            <p className="eyebrow px-5 pt-4 text-slate">By priority tier</p>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-slate">
                <tr>
                  {["Tier", "Treatment", "Universe", "Banked", "Outstanding", "%"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-5 py-2 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.tiers.map((t) => (
                  <tr key={t.tier} className="hover:bg-paper">
                    <td className="px-5 py-2 font-semibold text-ink">
                      {t.tier} — {CHASE_TIERS[t.tier].name}
                    </td>
                    <td className="px-5 py-2 text-xs text-slate">{t.treatment}</td>
                    <td className="px-5 py-2 text-right font-mono text-xs">{num(t.universe)}</td>
                    <td className="px-5 py-2 text-right font-mono text-xs text-field">{num(t.banked)}</td>
                    <td className="px-5 py-2 text-right font-mono text-xs text-brick">{num(t.outstanding)}</td>
                    <td className="px-5 py-2 text-right font-mono text-xs">{t.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 card overflow-hidden p-0">
            <p className="eyebrow px-5 pt-4 text-slate">Largest outstanding chase universes (top 20 precincts)</p>
            <div className="max-h-[40vh] overflow-y-auto print:max-h-none">
              <table className="mt-2 w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-slate">
                  <tr>
                    {["Precinct", "County", "Universe", "Banked", "Outstanding"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-5 py-2 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.precincts.slice(0, 20).map((p) => (
                    <tr key={p.precinctKey} className="hover:bg-paper">
                      <td className="px-5 py-2 text-ink">{p.precinctKey.split("#")[1]}</td>
                      <td className="px-5 py-2 text-slate">{p.county}</td>
                      <td className="px-5 py-2 text-right font-mono text-xs">{num(p.universe)}</td>
                      <td className="px-5 py-2 text-right font-mono text-xs text-field">{num(p.banked)}</td>
                      <td className="px-5 py-2 text-right font-mono text-xs text-brick">{num(p.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-2 text-[0.7rem] text-slate">
            Universe = identified/likely supporters in chase Tiers 1-4 (grows as canvass IDs land). Banked = matched
            returned ballots from the imported county files. {RSMO_NOTICE}
          </p>
        </div>
      )}

      {aggs.length > 0 && (
        <div className="mt-6">
          <ReturnsImport />
        </div>
      )}
    </>
  );
}
