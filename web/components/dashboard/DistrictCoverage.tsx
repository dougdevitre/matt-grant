import { MO02_COUNTIES, RESOLUTION_LABEL, STATUS_LABEL, type Status } from "@/lib/countySources";

const statusStyle: Record<Status, string> = {
  live: "bg-field/15 text-field",
  "live-old-map": "bg-brick/12 text-brick",
  available: "bg-gold/20 text-[#8a6010]",
  "needs-source": "bg-line text-slate",
};

export function DistrictCoverage() {
  const live = MO02_COUNTIES.filter((c) => c.status === "live").length;
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-brick">Data coverage</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">MO-02 counties (2025 enacted map)</h2>
        </div>
        <p className="font-mono text-xs text-slate">{live} of {MO02_COUNTIES.length} fully live</p>
      </div>

      <div className="mb-5 rounded-sm border border-brick/30 bg-brick/5 px-4 py-3 text-sm text-slate">
        <p className="font-semibold text-ink">Map note — verified June 2026.</p>
        <p className="mt-1">
          The 2025 mid-decade map (signed Sep 28 2025; upheld by the MO Supreme Court Mar 24 2026) is being
          used for the Aug 4 2026 primary — a ballot initiative could still suspend it. The new MO-02 = southern
          St. Louis County suburbs + Jefferson, Washington, Crawford, Gasconade. <strong>St. Charles &amp; Warren
          moved out to MO-03; Franklin is not in the new MO-02.</strong> Our live St. Louis County turnout is
          tagged to the OLD (western-county) lines and needs re-derivation against the new boundary.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {MO02_COUNTIES.map((c) => (
          <div key={c.county} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{c.county}</p>
                <p className="text-xs text-slate">{c.role}</p>
              </div>
              <span className={`shrink-0 rounded-sm px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow ${statusStyle[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <p className="mt-3 text-sm text-ink">
              <span className="font-mono text-xs text-field">{RESOLUTION_LABEL[c.resolution]}</span> — {c.note}
            </p>
            {c.endpoints && (
              <ul className="mt-3 space-y-1">
                {c.endpoints.map((e) => (
                  <li key={e.url} className="truncate">
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[0.7rem] text-slate hover:text-field hover:underline">
                      {e.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-slate">
        Next: add a geo-proxy per county (same pattern as <span className="font-mono">lib/geoSources.ts</span>),
        normalize what each provides, and merge. Confirm the map in legal effect before relying on this
        geography — see <span className="font-mono">candidate/data-and-map-plan.md</span> §0.
      </p>
    </section>
  );
}
