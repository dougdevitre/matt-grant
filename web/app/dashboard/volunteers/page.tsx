import { getVolunteers } from "@/lib/queries";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { updateVolunteerStatus } from "@/app/dashboard/actions";

const STATUSES = ["NEW", "ACTIVE", "INACTIVE"] as const;

const badge: Record<string, string> = {
  NEW: "bg-gold/15 text-[#9a6f1a]",
  ACTIVE: "bg-field/15 text-field",
  INACTIVE: "bg-line text-slate",
};

export default async function VolunteersPage() {
  const { connected, rows } = await getVolunteers();

  return (
    <>
      <PageHeader kicker="Field" title="Volunteers">
        {connected && <span className="font-mono text-sm text-slate">{rows.length} signed up</span>}
      </PageHeader>

      {!connected && <DbNotice />}

      <HowTo
        steps={[
          "Leads arrive here automatically from the public /contact form — no manual entry needed.",
          "Each card shows the volunteer’s name, city, stated interests, and contact info.",
          "Set their status with the dropdown — NEW → ACTIVE once you have engaged them, INACTIVE if they drop off — then click Save.",
          "Reach out to ACTIVE volunteers first when you staff canvasses, phone banks, and Election Day shifts.",
        ]}
      />

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-slate">
          No volunteers yet. Leads from the public <span className="font-mono">/contact</span> form land here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((v) => (
            <div key={v.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">{v.name}</p>
                  {v.city && <p className="text-sm text-slate">{v.city}</p>}
                </div>
                <span className={`rounded-sm px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow ${badge[v.status]}`}>
                  {v.status}
                </span>
              </div>
              {v.interests && <p className="mt-3 text-sm text-slate">{v.interests}</p>}
              {v.notes && (
                <p className="mt-2 rounded-sm border-l-2 border-line bg-paper px-3 py-2 text-sm italic text-slate">
                  &ldquo;{v.notes}&rdquo;
                </p>
              )}
              {v.email && <p className="mt-2 font-mono text-xs text-field">{v.email}</p>}
              {v.phone && <p className="font-mono text-xs text-field">{v.phone}</p>}

              <form action={updateVolunteerStatus} className="mt-4 flex items-center gap-2">
                <input type="hidden" name="id" value={v.id} />
                <select
                  name="status"
                  aria-label="Volunteer status"
                  defaultValue={v.status}
                  className="flex-1 rounded-sm border border-line bg-white px-2 py-1.5 text-xs text-ink"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">Save</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
