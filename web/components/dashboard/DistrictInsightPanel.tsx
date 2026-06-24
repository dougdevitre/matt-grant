import type { DistrictInsight } from "@/lib/events/insights";
import { districtLabel } from "@/lib/events/districts";
import { generateInsight } from "@/app/dashboard/events/actions";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

const usd = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-paper px-3 py-2">
      <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

export function DistrictInsightPanel({
  insight,
  districtKey,
  eventId,
}: {
  insight: DistrictInsight | null;
  districtKey: string;
  eventId: string;
}) {
  const label = insight?.label ?? districtLabel(districtKey);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-ink">District snapshot — {label}</h3>
        <form action={generateInsight}>
          <input type="hidden" name="districtKey" value={districtKey} />
          <input type="hidden" name="id" value={eventId} />
          <SubmitButton className="btn-ghost text-xs" pendingText="Generating…">
            {insight ? "Refresh" : "Generate now"}
          </SubmitButton>
        </form>
      </div>

      {!insight ? (
        <p className="mt-3 text-sm text-slate">
          No snapshot cached yet. It refreshes nightly, or click <em>Generate now</em>. Demographics come from the U.S. Census
          ACS; the field note is AI-summarized from those numbers only.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Population" value={num(insight.demographics.population)} />
            <Stat label="Median income" value={usd(insight.demographics.medianHouseholdIncome)} />
            <Stat label="Median age" value={insight.demographics.medianAge == null ? "—" : String(insight.demographics.medianAge)} />
            <Stat label="Median home" value={usd(insight.demographics.medianHomeValue)} />
            <Stat label="Bachelor's+" value={insight.demographics.bachelorsPlusPct == null ? "—" : `${insight.demographics.bachelorsPlusPct}%`} />
          </div>
          <div className="mt-3 space-y-1.5 text-sm text-ink">
            {insight.blurb.map((b, i) => <p key={i}>{b}</p>)}
          </div>
          <p className="mt-3 text-[0.7rem] text-slate">
            {insight.source === "ai" ? "AI-summarized from Census ACS data" : "From Census ACS data"} ·{" "}
            <a href={insight.demographics.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-field underline">
              Source
            </a>{" "}
            · generated {new Date(insight.generatedAt).toLocaleDateString("en-US")}
          </p>
        </>
      )}
    </div>
  );
}
