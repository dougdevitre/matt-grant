import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listRegions } from "@/lib/volunteers/regions";
import { listActiveCaptains } from "@/lib/volunteers/captains";
import { buildCoverage, SPAN_MAX, type CoverageRow } from "@/lib/volunteers/coverage";

export const dynamic = "force-dynamic";

const Stat = ({ label, value, tone }: { label: string; value: number; tone?: "ink" | "brick" | "gold" }) => (
  <div className="card p-4">
    <p className={`font-display text-2xl ${tone === "brick" ? "text-brick" : tone === "gold" ? "text-gold" : "text-ink"}`}>{value}</p>
    <p className="mt-0.5 text-[0.7rem] uppercase tracking-eyebrow text-slate">{label}</p>
  </div>
);

const Flag = ({ kind }: { kind: "gap" | "overlap" | "over" }) => {
  const map = {
    gap: { cls: "bg-brick/10 text-brick", text: "Gap — no captain" },
    overlap: { cls: "bg-gold/15 text-ink", text: "Overlap" },
    over: { cls: "bg-gold/15 text-ink", text: `Over ${SPAN_MAX} — split` },
  } as const;
  const f = map[kind];
  return <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${f.cls}`}>{f.text}</span>;
};

function RegionRows({ rows }: { rows: CoverageRow[] }) {
  return (
    <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
      {rows.map((r) => (
        <li key={`${r.region.level}:${r.region.name}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <span className="text-ink">{r.region.name}</span>
            <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{r.region.level}</span>
            <span className="block text-[0.7rem] text-slate">
              {r.captains.length
                ? r.captains.map((c) => `${c.firstName} (${c.teamSize})`).join(" · ")
                : "Unassigned"}
            </span>
          </span>
          <span className="shrink-0 text-[0.7rem] text-slate">{r.teamSize} on team</span>
          <span className="flex shrink-0 flex-wrap gap-1.5">
            {r.gap && <Flag kind="gap" />}
            {r.overlap && <Flag kind="overlap" />}
            {r.overSpan && <Flag kind="over" />}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function CoveragePage() {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) redirect("/dashboard?denied=coverage");

  const [regions, captains] = await Promise.all([listRegions(), listActiveCaptains()]);
  const rep = buildCoverage(regions, captains);

  return (
    <>
      <PageHeader kicker="Field" title="Coverage map" />
      <HowTo
        steps={[
          "Each region comes from the Airtable Geo Hierarchy (county → city/township → precinct). Assign captains to regions on the Team page.",
          "A Gap means no captain covers that region — recruit or assign one. An Overlap means more than one captain shares it; clarify ownership or split the turf.",
          `Over ${SPAN_MAX} flags a region whose combined team has reached the span-of-control max — promote a strong volunteer to captain and split.`,
          "Team size counts volunteers whose captain covers the region; a captain assigned to several regions counts in each.",
        ]}
      />

      {regions.length === 0 ? (
        <div className="mt-6 card p-6">
          <p className="font-display text-lg text-ink">No regions configured yet</p>
          <p className="mt-2 max-w-2xl text-sm text-slate">
            The coverage map reads the <strong>Geo Hierarchy</strong> table in the volunteer Airtable base. Add the
            regions MO-02 should be split into (e.g. counties, then cities/townships) with an <em>Area Name</em> and{" "}
            <em>Geo Level</em>, then assign captains to them on the{" "}
            <Link href="/dashboard/team" className="text-brick underline">Team page</Link>.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Regions" value={rep.totals.regions} />
            <Stat label="Covered" value={rep.totals.covered} />
            <Stat label="Gaps" value={rep.totals.gaps} tone={rep.totals.gaps ? "brick" : "ink"} />
            <Stat label="Overlaps" value={rep.totals.overlaps} tone={rep.totals.overlaps ? "gold" : "ink"} />
            <Stat label={`Over ${SPAN_MAX}`} value={rep.totals.overSpan} tone={rep.totals.overSpan ? "gold" : "ink"} />
            <Stat label="Captains" value={rep.totals.captains} />
          </div>

          <div className="mt-8">
            <p className="eyebrow text-slate">Regions</p>
            <RegionRows rows={rep.rows} />
          </div>

          {rep.unknownRegions.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow text-brick">Assigned to a region not in the hierarchy</p>
              <p className="mt-1 max-w-2xl text-sm text-slate">
                These captains are tagged with a region name that isn&rsquo;t in the Geo Hierarchy — likely a typo or a
                renamed area. Fix the captain&rsquo;s regions on the Team page, or add the region in Airtable.
              </p>
              <RegionRows rows={rep.unknownRegions} />
            </div>
          )}

          {rep.unassigned.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow text-slate">Captains with no region</p>
              <p className="mt-1 max-w-2xl text-sm text-slate">
                Active captains who haven&rsquo;t been assigned a region yet. Volunteers can&rsquo;t auto-match to them by
                area until you assign one on the{" "}
                <Link href="/dashboard/team" className="text-brick underline">Team page</Link>.
              </p>
              <ul className="mt-3 divide-y divide-line rounded-sm border border-line">
                {rep.unassigned.map((c) => (
                  <li key={c.email} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-ink">{c.firstName}</span>
                    <span className="text-[0.7rem] text-slate">{c.teamSize} on team</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}
