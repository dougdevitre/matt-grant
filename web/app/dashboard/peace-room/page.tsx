import Link from "next/link";
import type { Metadata } from "next";
import { requireCap } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Notice";
import { getIssue } from "@/lib/issues";
import { ISSUE_AXES, type IssueId } from "@/lib/integrations/research/issues";
import { getStoredCandidates, getTimeline } from "@/lib/integrations/research/store";
import { getBills } from "@/lib/integrations/legislative/store";
import { rankByFamilyCourtRelevance } from "@/lib/analysis/childAct";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peace Room — the case for change" };

// The shared Peace Room board. This is the ONE dashboard surface a `partner`
// (external coalition member / allied campaign) can reach — gated on
// viewPeaceRoom — so it must contain NO private campaign data. It pairs, per
// documented priority, the change Matt is fighting for (faithful to platform.md
// via ISSUE_AXES) with a SOURCED indicator that it's time for change.
//
// Honesty rule (same as countyTurnout): only real, sourced data appears here.
// Where a feed isn't connected yet, the panel says so — it never invents a stat.

type Indicator = { value: string; caption: string; source?: string } | null;

export default async function PeaceRoomPage() {
  await requireCap("viewPeaceRoom");

  // Indicators are derived from the incumbent's public record (Congress.gov via
  // the research ingest). Resolve the incumbent once, then read both feeds.
  // Everything degrades to "pending" when no ingest has run — never a guess.
  const incumbent = await getStoredCandidates()
    .then((cs) => cs.find((c) => c.incumbent) ?? null)
    .catch(() => null);

  // Term limits: tenure — careerism the seat was never meant to reward.
  let tenure: Indicator = null;
  // Family courts: how much of the incumbent's record touches the CHILD Act's
  // Title IV-D family-court-accountability lever. A low number is the gap Matt
  // is running to close.
  let familyCourts: Indicator = null;

  if (incumbent) {
    try {
      const t = await getTimeline(incumbent.slug);
      if (t?.totalTerms && t.firstYear) {
        tenure = {
          value: `${t.totalTerms} terms`,
          caption: `in office since ${t.firstYear} — the careerism term limits are meant to end.`,
          source: "Congress.gov",
        };
      }
    } catch {
      /* pending */
    }
    if (incumbent.bioguideId) {
      try {
        const bills = await getBills(incumbent.bioguideId);
        if (bills.length) {
          const relevant = rankByFamilyCourtRelevance(bills);
          familyCourts = {
            value: `${relevant.length} of ${bills.length}`,
            caption:
              relevant.length === 0
                ? "bills in the incumbent's record touch family-court accountability — the gap Matt is running to close."
                : "bills in the incumbent's record touch family-court accountability.",
            source: "Congress.gov",
          };
        }
      } catch {
        /* pending */
      }
    }
  }

  // Term limits and family courts have wired, sourced feeds; smaller government
  // and lower taxes are explicitly pending rather than fabricated.
  const indicatorFor = (id: IssueId): Indicator =>
    id === "term-limits" ? tenure : id === "family-courts" ? familyCourts : null;

  return (
    <>
      <PageHeader kicker="Restore public trust" title="The case for change" />

      <p className="mt-4 max-w-3xl text-slate">
        This is the shared room — where the campaign, allied candidates, and coalition partners make
        one case together: the data shows it&apos;s time for a change in MO-02. Each priority below pairs
        the change we&apos;re fighting for with a sourced indicator of why now. Nothing here is a guess —
        where a feed isn&apos;t connected yet, it says so.
      </p>

      <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        {ISSUE_AXES.map((axis) => {
          const issue = getIssue(axis.id);
          const ind = indicatorFor(axis.id);
          return (
            <section key={axis.id} className="bg-paper p-6">
              <p className="eyebrow text-brick">{axis.label}</p>
              <h3 className="mt-2 font-display text-xl font-semibold text-ink">
                {issue?.title ?? axis.label}
              </h3>
              {issue?.tagline && <p className="mt-1 text-sm text-slate">{issue.tagline}</p>}

              <div className="mt-4 rounded-sm border border-line bg-ink/[0.02] p-4">
                <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                  The indicator
                </p>
                {ind ? (
                  <>
                    <p className="mt-1 text-2xl font-semibold text-brick">{ind.value}</p>
                    <p className="mt-1 text-sm text-ink">{ind.caption}</p>
                    {ind.source && (
                      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                        Source: {ind.source}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-slate">
                    Data pending — a sourced feed for this priority isn&apos;t connected yet.
                  </p>
                )}
              </div>

              <p className="mt-4 text-xs font-semibold text-ink">The change we&apos;re fighting for</p>
              <p className="mt-1 text-sm text-slate">{axis.mattSummary}</p>

              {issue && (
                <Link
                  href={`/issues/${issue.slug}`}
                  className="mt-4 inline-block text-sm font-semibold text-brick hover:underline"
                >
                  Read the argument →
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 max-w-3xl text-xs text-slate">
        Educational and informational only. Partners see this shared case and nothing else — donors,
        finance, compliance, and internal campaign data stay private to the campaign team.
      </p>
    </>
  );
}
