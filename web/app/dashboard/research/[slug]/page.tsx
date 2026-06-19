import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/Notice";
import { dbConfigured } from "@/lib/db";
import { getCandidate, partyLabel } from "@/lib/integrations/research/candidates";
import { statementsFor } from "@/lib/integrations/statements/data";
import { alignCandidate } from "@/lib/analysis/alignment";
import { ISSUE_AXES, axis } from "@/lib/integrations/research/issues";
import { getFec } from "@/lib/integrations/research/store";
import { getVotes, getBills } from "@/lib/integrations/legislative/store";

export const dynamic = "force-dynamic";

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

const VERDICT_TEXT = { agree: "text-field", differ: "text-brick", unknown: "text-slate" } as const;
const VERDICT_LABEL = { agree: "Agrees with Matt", differ: "Differs", unknown: "No sourced position" } as const;

export default async function CandidatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCandidate(slug);
  if (!c) notFound();

  const statements = statementsFor(slug);
  const a = alignCandidate(c, statements);

  let fec = null,
    votes: Awaited<ReturnType<typeof getVotes>> = [],
    bills: Awaited<ReturnType<typeof getBills>> = [];
  if (dbConfigured) {
    try {
      [fec, votes, bills] = await Promise.all([
        getFec(slug),
        c.bioguideId ? getVotes(c.bioguideId) : Promise.resolve([]),
        c.bioguideId ? getBills(c.bioguideId, { relation: "sponsored" }) : Promise.resolve([]),
      ]);
    } catch {
      /* degrade */
    }
  }

  return (
    <>
      <PageHeader kicker="Field & alignment research" title={c.name}>
        <Link href="/dashboard/research" className="font-mono text-xs text-field hover:underline">
          ← field
        </Link>
      </PageHeader>

      <p className="mb-6 text-sm text-slate">
        {partyLabel(c.party)} · {c.primary} primary{c.incumbent ? " · incumbent" : ""} · {c.office ?? "U.S. House MO-02"}
        {c.website ? (
          <>
            {" · "}
            <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-field hover:underline">
              campaign site ↗
            </a>
          </>
        ) : null}
      </p>

      {/* Alignment readout */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold text-ink">Alignment with Matt</h2>
          <span className="font-mono text-sm text-slate">
            {a.score === null ? "no known stances" : `${Math.round(a.score * 100)}% on ${a.knownCount} known`}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {ISSUE_AXES.map((ax) => {
            const al = a.axes.find((x) => x.issueId === ax.id)!;
            return (
              <div key={ax.id} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{ax.label}</span>
                  <span className={`font-mono text-xs ${VERDICT_TEXT[al.verdict]}`}>{VERDICT_LABEL[al.verdict]}</span>
                </div>
                <p className="mt-2 text-xs text-slate">Matt: {axis(ax.id).mattSummary}</p>
                {al.summary && <p className="mt-2 text-sm text-ink">Them: {al.summary}</p>}
                {al.sourceUrl && (
                  <a href={al.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-xs text-field hover:underline">
                    source ↗
                  </a>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`/api/research/script?candidate=${slug}`} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
            coalition script ↗
          </a>
          <a href={`/api/research/graphic?candidate=${slug}`} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
            common-ground card ↗
          </a>
          <a href={`/api/research/alignment?candidate=${slug}`} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
            alignment JSON ↗
          </a>
        </div>
      </section>

      {/* FEC money */}
      <section className="mb-10">
        <h2 className="mb-3 font-display text-2xl font-semibold text-ink">Campaign finance (FEC)</h2>
        {fec ? (
          <div className="card p-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Raised", fec.totals.receipts],
                ["Spent", fec.totals.disbursements],
                ["Cash on hand", fec.totals.cashOnHand],
                ["From individuals", fec.totals.individualContributions],
              ].map(([label, val]) => (
                <div key={label as string}>
                  <div className="font-mono text-lg font-bold text-ink">{usd(val as number | null)}</div>
                  <div className="text-xs text-slate">{label as string}</div>
                </div>
              ))}
            </div>
            <a href={fec.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-mono text-xs text-field hover:underline">
              fec.gov ↗ · cycle {fec.cycle}
            </a>
          </div>
        ) : (
          <p className="card p-6 text-sm text-slate">
            No FEC data stored{c.fecCandidateId ? "" : " (no FEC candidate id set)"}. Set FEC_API_KEY + the candidate&apos;s
            fecCandidateId, then trigger /api/research/ingest.
          </p>
        )}
      </section>

      {/* Federal record — members only */}
      {c.bioguideId ? (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-2xl font-semibold text-ink">Federal record</h2>
          {votes.length === 0 && bills.length === 0 ? (
            <p className="card p-6 text-sm text-slate">No federal record stored yet. Trigger /api/research/ingest.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate">Recent roll-call votes</h3>
                <div className="card divide-y divide-line p-0">
                  {votes.slice(0, 12).map((v) => (
                    <div key={v.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-ink">
                        <span className="font-mono text-xs text-slate">#{v.rollNumber}</span> {v.legisNum ?? v.question}
                      </span>
                      <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-field hover:underline">
                        {v.position ?? "—"} ↗
                      </a>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate">Sponsored legislation</h3>
                <div className="card divide-y divide-line p-0">
                  {bills.slice(0, 12).map((b) => (
                    <a key={b.id} href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 text-sm hover:bg-paper">
                      <span className="font-mono text-xs text-field">{b.billType} {b.number}</span> {b.title ?? "(untitled)"}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-2xl font-semibold text-ink">Federal record</h2>
          <p className="card p-6 text-sm text-slate">
            Not a current/former member of Congress — no federal voting record. Alignment is drawn from FEC money and
            cited public statements above.
          </p>
        </section>
      )}

      {/* All sourced statements */}
      <section>
        <h2 className="mb-3 font-display text-2xl font-semibold text-ink">Sourced statements</h2>
        {statements.length === 0 ? (
          <p className="card p-6 text-sm text-slate">
            No sourced statements yet. Add cited entries via RESEARCH_STATEMENTS_JSON — every entry needs a source_url.
          </p>
        ) : (
          <div className="space-y-2">
            {statements.map((s, i) => (
              <div key={`${s.issueId}-${i}`} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
                    {axis(s.issueId).label} · {s.stance} · {s.sourceType}
                  </span>
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-field hover:underline">
                    source ↗
                  </a>
                </div>
                <p className="mt-2 text-sm text-ink">{s.summary}</p>
                {s.quote && <p className="mt-1 border-l-2 border-line pl-3 text-sm italic text-slate">“{s.quote}”</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-slate">
        Public primary sources only. Cite the source on every claim — never this dashboard. Have election counsel
        confirm disclaimers before any public use. See <span className="font-mono">candidate/contrast-positioning.md</span>.
      </p>
    </>
  );
}
