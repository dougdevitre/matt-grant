import { MO02_COUNTIES, RESOLUTION_LABEL, STATUS_LABEL, type Status } from "@/lib/countySources";

const statusStyle: Record<Status, string> = {
  live: "bg-field/15 text-field",
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
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">MO-02 counties (2025 map)</h2>
        </div>
        <p className="font-mono text-xs text-slate">{live}/{MO02_COUNTIES.length} counties live</p>
      </div>

      <p className="mb-5 max-w-prose text-sm text-slate">
        MO-02 spans more than St. Louis County. Precinct-level turnout is only published by St. Louis
        County; the added rural counties offer boundaries/polling at best, with turnout at the county
        level (SOS). This tracks exactly what's wired and what's next.
      </p>

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
