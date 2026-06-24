import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCap } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Notice";
import { dbConfigured } from "@/lib/db";
import { getCandidate, partyLabel } from "@/lib/integrations/research/candidates";
import { statementsFor } from "@/lib/integrations/statements/data";
import { alignCandidate } from "@/lib/analysis/alignment";
import { ISSUE_AXES, axis } from "@/lib/integrations/research/issues";
import { getFec, getDonorProfile, getFecDetail, getWikiBio, getNews, getStateLeg } from "@/lib/integrations/research/store";
import { getVotes, getBills } from "@/lib/integrations/legislative/store";
import { CoalitionScript } from "@/components/dashboard/CoalitionScript";
import { ContrastCard } from "@/components/dashboard/ContrastCard";

export const dynamic = "force-dynamic";

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);

const VERDICT_TEXT = { agree: "text-field", differ: "text-brick", unknown: "text-slate" } as const;
const VERDICT_LABEL = { agree: "Agrees with Matt", differ: "Differs", unknown: "No sourced position" } as const;

export default async function CandidatePage({ params }: { params: Promise<{ slug: string }> }) {
  await requireCap("viewResearch"); // gate the per-candidate drilldown too (H1)
  const { slug } = await params;
  const c = getCandidate(slug);
  if (!c) notFound();

  const statements = statementsFor(slug);
  const a = alignCandidate(c, statements);

  let fec = null,
    donors: Awaited<ReturnType<typeof getDonorProfile>> = null,
    detail: Awaited<ReturnType<typeof getFecDetail>> = null,
    bio: Awaited<ReturnType<typeof getWikiBio>> = null,
    news: Awaited<ReturnType<typeof getNews>> = null,
    stateLeg: Awaited<ReturnType<typeof getStateLeg>> = null,
    votes: Awaited<ReturnType<typeof getVotes>> = [],
    bills: Awaited<ReturnType<typeof getBills>> = [];
  if (dbConfigured) {
    try {
      [fec, donors, detail, bio, news, stateLeg, votes, bills] = await Promise.all([
        getFec(slug),
        getDonorProfile(slug),
        getFecDetail(slug),
        getWikiBio(slug),
        getNews(slug),
        c.stateLegId ? getStateLeg(slug) : Promise.resolve(null),
        c.bioguideId ? getVotes(c.bioguideId) : Promise.resolve([]),
        c.bioguideId ? getBills(c.bioguideId, { relation: "sponsored" }) : Promise.resolve([]),
      ]);
    } catch {
      /* degrade */
    }
  }
  const hasDonorData =
    donors && (donors.topEmployers.length || donors.topOccupations.length || donors.bySize.length || donors.byState.length);

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

      {/* Background (Wikipedia) */}
      {bio && (
        <section className="mb-8">
          <div className="card flex gap-4 p-5">
            {bio.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bio.thumbnail} alt={bio.title} loading="lazy" className="hidden h-20 w-20 shrink-0 rounded-sm object-cover sm:block" />
            ) : null}
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                Background{bio.description ? <span className="font-normal text-slate"> · {bio.description}</span> : null}
              </h2>
              <p className="mt-1 text-sm text-slate">{bio.extract}</p>
              <a href={bio.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-mono text-xs text-field hover:underline">
                Wikipedia ↗
              </a>
            </div>
          </div>
        </section>
      )}

      {/* In the news (Google News) */}
      {news && news.items.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">In the news</h2>
          <p className="mb-3 text-xs text-slate">Recent coverage via Google News — linked headlines, not our characterization. Verify each at the source.</p>
          <ul className="card divide-y divide-line p-0">
            {news.items.map((n, i) => (
              <li key={`news-${i}`} className="px-4 py-2.5">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink hover:underline">
                  {n.title}
                </a>
                <div className="mt-0.5 text-xs text-slate">
                  {n.source ?? "—"}
                  {n.date ? ` · ${new Date(n.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <div className="mt-4 space-y-3">
          {/* Coalition script rendered inline (was a bare link to raw text/plain). */}
          <CoalitionScript slug={slug} name={c.name} />
          <ContrastCard slug={slug} name={c.name} />
          <div className="flex flex-wrap gap-2">
            <a href={`/api/research/graphic?candidate=${slug}`} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
              common-ground card ↗
            </a>
            <a href={`/api/research/alignment?candidate=${slug}`} target="_blank" rel="noopener noreferrer" className="rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink">
              alignment JSON ↗
            </a>
          </div>
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

      {/* Donor profile (FEC Schedule A aggregates) */}
      {hasDonorData && donors && (
        <section className="mb-10">
          <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Donor profile</h2>
          <p className="mb-3 text-xs text-slate">Who funds them — from FEC itemized receipts (Schedule A). Describes the money, not donors personally.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["Top employers", donors.topEmployers],
              ["Top occupations", donors.topOccupations],
              ["By gift size", donors.bySize],
              ["By state", donors.byState],
            ] as const).map(([label, buckets]) => (
              <div key={label} className="card p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-eyebrow text-slate">{label}</h3>
                {buckets.length === 0 ? (
                  <p className="text-xs text-slate">—</p>
                ) : (
                  <ul className="space-y-1">
                    {buckets.slice(0, 6).map((b, i) => (
                      <li key={`${label}-${i}`} className="flex justify-between gap-2 text-sm">
                        <span className="truncate text-ink">{b.label}</span>
                        <span className="shrink-0 font-mono text-xs text-slate">{usd(b.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
          <a href={donors.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-mono text-xs text-field hover:underline">
            fec.gov ↗
          </a>
        </section>
      )}

      {/* Outside money + spending breakdown (FEC Schedule E / B) */}
      {detail && (detail.ie.support > 0 || detail.ie.oppose > 0 || detail.spending.byPurpose.length > 0) && (
        <section className="mb-10">
          <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Outside money &amp; spending</h2>
          <p className="mb-3 text-xs text-slate">
            Independent expenditures by OTHER committees for/against them (FEC Schedule E) and how their own campaign
            spends (Schedule B). Public data — cite fec.gov, not this dashboard.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-eyebrow text-slate">Outside money (for / against)</h3>
              <div className="mb-3 flex gap-8">
                <div>
                  <div className="font-mono text-lg font-bold text-field">{usd(detail.ie.support)}</div>
                  <div className="text-xs text-slate">spent supporting</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-bold text-brick">{usd(detail.ie.oppose)}</div>
                  <div className="text-xs text-slate">spent opposing</div>
                </div>
              </div>
              {detail.ie.topSpenders.length > 0 ? (
                <ul className="space-y-1 border-t border-line pt-2">
                  {detail.ie.topSpenders.map((s, i) => (
                    <li key={`ie-${i}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-ink">{s.committee}</span>
                      <span className={`shrink-0 font-mono text-xs ${s.stance === "oppose" ? "text-brick" : "text-field"}`}>
                        {s.stance === "oppose" ? "✕ " : "✓ "}
                        {usd(s.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate">No independent expenditures on record.</p>
              )}
            </div>
            <div className="card p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-eyebrow text-slate">Where the campaign spends</h3>
              {detail.spending.byPurpose.length > 0 ? (
                <ul className="space-y-1">
                  {detail.spending.byPurpose.map((b, i) => (
                    <li key={`sp-${i}`} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-ink">{b.purpose}</span>
                      <span className="shrink-0 font-mono text-xs text-slate">{usd(b.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate">No itemized disbursements on record.</p>
              )}
            </div>
          </div>
          <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-mono text-xs text-field hover:underline">
            fec.gov independent expenditures ↗
          </a>
        </section>
      )}

      {/* State legislative record (Open States) */}
      {c.stateLegId && (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-2xl font-semibold text-ink">State legislative record</h2>
          {stateLeg ? (
            <div className="card p-5">
              <p className="text-sm text-slate">
                {stateLeg.currentRole ?? "MO General Assembly"} · {stateLeg.party ?? "—"}
              </p>
              <h3 className="mt-3 mb-2 text-xs font-semibold uppercase tracking-eyebrow text-slate">Sponsored bills</h3>
              <div className="divide-y divide-line">
                {stateLeg.sponsored.slice(0, 12).map((b, i) => (
                  <a key={`${b.identifier}-${i}`} href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="block py-2 text-sm hover:bg-paper">
                    <span className="font-mono text-xs text-field">{b.identifier}</span> {b.title ?? "(untitled)"}
                  </a>
                ))}
              </div>
              <a href={stateLeg.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-mono text-xs text-field hover:underline">
                openstates.org ↗
              </a>
            </div>
          ) : (
            <p className="card p-6 text-sm text-slate">
              No state record stored. Set OPENSTATES_API_KEY, then trigger /api/research/ingest.
            </p>
          )}
        </section>
      )}

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
