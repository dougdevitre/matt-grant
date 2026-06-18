import { PageHeader, DbNotice, HowTo } from "@/components/dashboard/Notice";
import { dbConfigured } from "@/lib/db";
import { loadConfig, congressEnabled } from "@/lib/integrations/legislative/config";
import { getMember, getVotes, getBills, lastIngest } from "@/lib/integrations/legislative/store";

export const dynamic = "force-dynamic";

const POSITIONS = ["", "Yea", "Nay", "Present", "Not Voting"];

const posColor: Record<string, string> = {
  Yea: "text-field",
  Nay: "text-brick",
  Present: "text-[#1d4ed8]",
  "Not Voting": "text-slate",
};

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ position?: string; relation?: string }>;
}) {
  const sp = await searchParams;
  const { bioguideId } = loadConfig();
  const position = sp.position ?? "";
  const relation = sp.relation ?? "sponsored";

  if (!dbConfigured) {
    return (
      <>
        <PageHeader kicker="Opposition research" title="Legislative record" />
        <DbNotice />
      </>
    );
  }

  let member = null,
    votes: Awaited<ReturnType<typeof getVotes>> = [],
    bills: Awaited<ReturnType<typeof getBills>> = [],
    run = null,
    dbError = false;
  try {
    [member, votes, bills, run] = await Promise.all([
      getMember(bioguideId),
      getVotes(bioguideId, { position: position || undefined }),
      getBills(bioguideId, { relation }),
      lastIngest(bioguideId),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader kicker="Opposition research" title="Legislative record">
        {run && (
          <span className="font-mono text-xs text-slate">
            last ingest: {run.ok ? "✓" : "✕"} {new Date(run.startedAt).toLocaleDateString()}
          </span>
        )}
      </PageHeader>

      <HowTo
        steps={[
          "Review the subject’s primary-source record: roll-call votes (House Clerk XML) and legislation (Congress.gov).",
          "Filter votes by position (Yea / Nay / Present / Not Voting) and bills by relation (sponsored / cosponsored).",
          "Open the “source ↗” link on any row — cite that source on every claim, never the dashboard itself.",
          "Check the “last ingest” date in the header; refresh data by triggering the research ingest job.",
          "Keep contrast factual — see candidate/contrast-positioning.md before using any of this publicly.",
        ]}
      />

      <div className="mb-6 rounded-sm border border-field/30 bg-field/5 px-4 py-3 text-sm text-slate">
        <p className="font-semibold text-ink">Primary-source record only.</p>
        <p className="mt-1">
          {member ? (
            <>
              {member.name} ({member.party ?? "—"}, {member.state ?? "—"}
              {member.district ? `-${member.district}` : ""}) · bioguide{" "}
              <span className="font-mono">{bioguideId}</span>. Votes from House Clerk roll-call XML; bills from
              Congress.gov. Every row links to its source.
            </>
          ) : (
            <>
              No record stored yet for <span className="font-mono">{bioguideId}</span>.{" "}
              {congressEnabled
                ? "Trigger ingestion (POST /api/research/ingest with the CRON_SECRET bearer)."
                : "Set CONGRESS_GOV_API_KEY + CRON_SECRET, then trigger /api/research/ingest."}
            </>
          )}
        </p>
        {dbError && <p className="mt-1 text-brick">Couldn&apos;t read the research store.</p>}
      </div>

      {/* Votes */}
      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-ink">Roll-call votes</h2>
          <div className="flex gap-1">
            {POSITIONS.map((p) => (
              <a
                key={p || "all"}
                href={`?position=${encodeURIComponent(p)}`}
                className={`rounded-sm border px-2.5 py-1 text-xs ${
                  position === p ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"
                }`}
              >
                {p || "All"}
              </a>
            ))}
          </div>
        </div>
        {votes.length === 0 ? (
          <p className="card p-6 text-sm text-slate">No votes stored{position ? ` with position "${position}"` : ""}.</p>
        ) : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {votes.slice(0, 100).map((v) => (
                  <tr key={v.id} className="hover:bg-paper">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate">
                      {v.year} #{v.rollNumber}
                    </td>
                    <td className={`px-4 py-2.5 font-mono text-xs font-bold ${posColor[v.position ?? ""] ?? "text-slate"}`}>
                      {v.position ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-ink">
                      <span className="font-semibold">{v.legisNum ?? ""}</span> {v.question}
                      {v.result ? <span className="text-slate"> · {v.result}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-field hover:underline">
                        source ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Bills */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold text-ink">Legislation</h2>
          <div className="flex gap-1">
            {["sponsored", "cosponsored"].map((r) => (
              <a
                key={r}
                href={`?relation=${r}`}
                className={`rounded-sm border px-2.5 py-1 text-xs capitalize ${
                  relation === r ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"
                }`}
              >
                {r}
              </a>
            ))}
          </div>
        </div>
        {bills.length === 0 ? (
          <p className="card p-6 text-sm text-slate">No {relation} bills stored.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {bills.slice(0, 60).map((b) => (
              <a
                key={b.id}
                href={b.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 hover:border-ink"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-field">
                    {b.billType} {b.number} · {b.congress}th
                  </span>
                  {b.policyArea && <span className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{b.policyArea}</span>}
                </div>
                <p className="mt-2 text-sm text-ink">{b.title ?? "(untitled)"}</p>
              </a>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-slate">
        Public federal records (Congress.gov + House Clerk). Use the cited source on every claim. Contrast must
        stay factual — see <span className="font-mono">candidate/contrast-positioning.md</span>.
      </p>
    </>
  );
}
