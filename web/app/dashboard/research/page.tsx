import Link from "next/link";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { dbConfigured } from "@/lib/db";
import { loadField, partyLabel } from "@/lib/integrations/research/candidates";
import { loadStatements } from "@/lib/integrations/statements/data";
import { analyzeField } from "@/lib/analysis/alignment";
import { ISSUE_AXES } from "@/lib/integrations/research/issues";
import { getAllFec } from "@/lib/integrations/research/store";
import { lastFieldIngest } from "@/lib/integrations/research/ingestField";
import type { FecSummary } from "@/lib/integrations/fec/types";

export const dynamic = "force-dynamic";

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const VERDICT = {
  agree: { mark: "✓", cls: "bg-field text-paper" },
  differ: { mark: "✕", cls: "bg-brick text-paper" },
  unknown: { mark: "·", cls: "bg-line text-slate" },
} as const;

export default async function ResearchPage() {
  const field = loadField().filter((c) => c.active !== false);
  const statements = loadStatements();
  const analysis = analyzeField(field, statements, new Date().toISOString());

  let fec: Record<string, FecSummary> = {};
  let run: Awaited<ReturnType<typeof lastFieldIngest>> = null;
  if (dbConfigured) {
    try {
      [fec, run] = await Promise.all([getAllFec(), lastFieldIngest()]);
    } catch {
      /* degrade to no money/run data */
    }
  }

  const bySlug = new Map(analysis.candidates.map((a) => [a.slug, a]));

  return (
    <>
      <PageHeader kicker="Field & alignment research" title="The MO-02 primary field">
        {run && (
          <span className="font-mono text-xs text-slate">
            last ingest: {run.ok ? "✓" : "✕"} {new Date(run.startedAt).toLocaleDateString()}
          </span>
        )}
      </PageHeader>

      <HowTo
        steps={[
          "Find common ground, not just contrast: the matrix shows where each candidate's SOURCED position agrees (✓) or differs (✕) from Matt's four pillars.",
          "“·” means no sourced position on record — it is unknown, never assumed. Curate cited statements via RESEARCH_STATEMENTS_JSON to fill it in.",
          "Use the coalition ranking to prioritize whose supporters are most persuadable and which exiting competitor is most endorsable.",
          "Open a candidate for their FEC money, federal record (members only), and a generated coalition script + share card.",
          "Every claim about a candidate needs its source link — cite the source, never this dashboard. See candidate/contrast-positioning.md before any public use.",
        ]}
      />

      {/* Coalition priority ranking */}
      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl font-semibold text-ink">Coalition priority</h2>
        <p className="mb-4 max-w-2xl text-sm text-slate">
          Ranked by sourced common ground with Matt (most bridges first, weighted by how much is on record).
          Open primary — persuadable Democrats and unaffiliated voters can pull a Republican ballot.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.coalitionRanking.map((r, i) => (
            <Link key={r.slug} href={`/dashboard/research/${r.slug}`} className="card p-4 hover:border-ink">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-field">#{i + 1}</span>
                <span className="font-mono text-xs text-slate">
                  {r.score === null ? "—" : `${Math.round(r.score * 100)}% align`}
                </span>
              </div>
              <p className="mt-2 font-semibold text-ink">{r.name}</p>
              <p className="mt-1 text-xs text-slate">
                {r.bridges} shared {r.bridges === 1 ? "priority" : "priorities"} · {r.confidence} sourced{" "}
                {r.confidence === 1 ? "statement" : "statements"}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Alignment matrix */}
      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl font-semibold text-ink">Alignment matrix</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-semibold text-ink">Candidate</th>
                {ISSUE_AXES.map((a) => (
                  <th key={a.id} className="px-3 py-3 text-center text-xs font-semibold text-slate">
                    {a.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate">$ on hand</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {field.map((c) => {
                const a = bySlug.get(c.slug)!;
                return (
                  <tr key={c.slug} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/research/${c.slug}`} className="font-medium text-ink hover:underline">
                        {c.name}
                      </Link>
                      <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                        {partyLabel(c.party)}
                        {c.incumbent ? " · incumbent" : ""}
                      </span>
                    </td>
                    {ISSUE_AXES.map((ax) => {
                      const v = a.axes.find((x) => x.issueId === ax.id)!.verdict;
                      const cfg = VERDICT[v];
                      return (
                        <td key={ax.id} className="px-3 py-3 text-center">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-sm font-bold ${cfg.cls}`}>
                            {cfg.mark}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate">{usd(fec[c.slug]?.totals.cashOnHand)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate">
          <span className="font-bold text-field">✓</span> sourced agreement ·{" "}
          <span className="font-bold text-brick">✕</span> sourced difference ·{" "}
          <span className="font-bold text-slate">·</span> no sourced position (unknown). Money from OpenFEC.
        </p>
      </section>

      {field.length <= 1 && (
        <div className="rounded-sm border border-field/30 bg-field/5 px-4 py-3 text-sm text-slate">
          <p className="font-semibold text-ink">Only the seed entry is loaded.</p>
          <p className="mt-1">
            Populate the field with{" "}
            <span className="font-mono">RESEARCH_FIELD_JSON</span> (candidate roster) and{" "}
            <span className="font-mono">RESEARCH_STATEMENTS_JSON</span> (sourced positions), then trigger{" "}
            <span className="font-mono">/api/research/ingest</span> with the CRON_SECRET bearer. See{" "}
            <span className="font-mono">candidate/opposition-research-expansion-plan.md</span>.
          </p>
        </div>
      )}

      <p className="mt-8 text-xs text-slate">
        Public primary sources only (OpenFEC, Congress.gov, House Clerk, cited statements). Contrast must stay
        factual — see <span className="font-mono">candidate/contrast-positioning.md</span>.
      </p>
    </>
  );
}
