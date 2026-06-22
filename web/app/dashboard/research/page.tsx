import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { dbConfigured } from "@/lib/db";
import { loadField, partyLabel } from "@/lib/integrations/research/candidates";
import { loadStatements } from "@/lib/integrations/statements/data";
import { analyzeField } from "@/lib/analysis/alignment";
import { ISSUE_AXES } from "@/lib/integrations/research/issues";
import { getAllFec, getAllFecDetail, getAllNews } from "@/lib/integrations/research/store";
import { lastFieldIngest } from "@/lib/integrations/research/ingestField";
import { fieldFreshness } from "@/lib/integrations/research/freshness";
import type { FecSummary, FecDetail } from "@/lib/integrations/fec/types";
import type { NewsFeed } from "@/lib/integrations/news/client";

export const dynamic = "force-dynamic";

const usd = (n: number | null | undefined) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const VERDICT = {
  agree: { mark: "✓", cls: "bg-field text-paper", label: "Agrees" },
  differ: { mark: "✕", cls: "bg-brick text-paper", label: "Differs" },
  unknown: { mark: "·", cls: "bg-line text-slate", label: "No sourced position" },
} as const;

export default async function ResearchPage() {
  await requireCap("viewResearch"); // members are denied; don't rely on the sidebar hiding the link (H1)
  const field = loadField().filter((c) => c.active !== false);
  const statements = loadStatements();
  const analysis = analyzeField(field, statements, new Date().toISOString());

  let fec: Record<string, FecSummary> = {};
  let detail: Record<string, FecDetail> = {};
  let news: Record<string, NewsFeed> = {};
  let run: Awaited<ReturnType<typeof lastFieldIngest>> = null;
  if (dbConfigured) {
    try {
      [fec, detail, news, run] = await Promise.all([getAllFec(), getAllFecDetail(), getAllNews(), lastFieldIngest()]);
    } catch {
      /* degrade to no money/run data */
    }
  }

  // Reliable freshness from the data's own timestamps (per-step retrievedAt),
  // not the run record — a heavy run can exceed the Lambda window and never write
  // its ok:true end-record even though the data landed fine.
  const fresh = fieldFreshness({ detail, news, fec, runAt: run?.startedAt ?? null });

  const bySlug = new Map(analysis.candidates.map((a) => [a.slug, a]));

  return (
    <>
      <PageHeader kicker="Field & alignment research" title="The MO-02 primary field">
        {fresh.latestAt ? (
          <span className={`font-mono text-xs ${fresh.stale ? "text-brick" : "text-slate"}`}>
            {fresh.stale ? "⚠ stale — " : "data as of "}
            {new Date(fresh.latestAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="font-mono text-xs text-brick">⚠ no candidate data ingested yet</span>
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
                <th scope="col" className="px-4 py-3 font-semibold text-ink">Candidate</th>
                {ISSUE_AXES.map((a) => (
                  <th key={a.id} scope="col" className="px-3 py-3 text-center text-xs font-semibold text-slate">
                    {a.label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate">$ on hand</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-slate">Outside $</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate">Latest coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {field.map((c) => {
                const a = bySlug.get(c.slug)!;
                const d = detail[c.slug];
                const outside = d ? d.ie.support + d.ie.oppose : 0;
                const latest = news[c.slug]?.items[0];
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
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-sm font-bold ${cfg.cls}`}
                            aria-hidden="true"
                          >
                            {cfg.mark}
                          </span>
                          <span className="sr-only">{`${ax.label}: ${cfg.label}`}</span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate">{usd(fec[c.slug]?.totals.cashOnHand)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate">
                      {outside > 0 ? (
                        <span title={`${usd(d!.ie.support)} supporting · ${usd(d!.ie.oppose)} opposing`}>{usd(outside)}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs">
                      {latest ? (
                        <a
                          href={latest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink hover:underline"
                          title={latest.title}
                        >
                          {latest.title.length > 64 ? `${latest.title.slice(0, 61)}…` : latest.title}
                        </a>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate">
          <span className="font-bold text-field">✓</span> sourced agreement ·{" "}
          <span className="font-bold text-brick">✕</span> sourced difference ·{" "}
          <span className="font-bold text-slate">·</span> no sourced position (unknown). <strong>Outside $</strong> =
          independent expenditures for + against (OpenFEC Schedule E); hover for the for/against split.{" "}
          <strong>Latest coverage</strong> links the most recent on-topic headline (Google News). Money from OpenFEC.
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
