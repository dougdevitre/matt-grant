import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getVolunteer, getTasks } from "@/lib/queries";
import { signVolunteerToken } from "@/lib/volunteer-link";
import { PageHeader } from "@/components/dashboard/Notice";
import { updateVolunteer, markVolunteerContacted, updateVolunteerNotes, updateVolunteerProfile } from "@/app/dashboard/actions";
import { promoteToCaptain } from "@/app/dashboard/team/actions";
import { VOLUNTEER_MODES, VOLUNTEER_AVAILABILITY, VOLUNTEER_SKILLS } from "@/lib/volunteer-profile";
import { requireCap } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "CONTACTED", "ACTIVE", "INACTIVE"] as const;
const badge: Record<string, string> = {
  NEW: "bg-gold/15 text-[#9a6f1a]",
  CONTACTED: "bg-field/10 text-field",
  ACTIVE: "bg-field/20 text-field",
  INACTIVE: "bg-line text-slate",
};
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// Module-scope so it isn't recreated each render (react-hooks/static-components).
const Row = ({ label, value }: { label: string; value: string | null }) =>
  value ? (
    <div className="flex gap-3 py-2">
      <span className="w-32 shrink-0 font-mono text-xs uppercase tracking-eyebrow text-slate">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  ) : null;

export default async function VolunteerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCap("manageVolunteers");
  const canPromote = can(gate.role, "manageTeam"); // admins only mint captains
  const { id } = await params;
  const v = await getVolunteer(id);
  if (!v) notFound();
  const { rows: allTasks } = await getTasks();
  const tasks = allTasks.filter((t) => t.volunteerId === v.id);
  // Private magic-link the captain can send so this volunteer sees & updates
  // their tasks without a login. Null when VOLUNTEER_LINK_SECRET is unset.
  const token = await signVolunteerToken(v.id);
  const reqHeaders = await headers();
  const origin = `${reqHeaders.get("x-forwarded-proto") ?? "https"}://${reqHeaders.get("host") ?? ""}`;
  const taskLink = token ? `${origin}/my-tasks/${token}` : null;

  return (
    <>
      <Link href="/dashboard/volunteers" className="font-mono text-xs text-slate hover:text-ink">← All volunteers</Link>
      <PageHeader kicker="Field · Volunteer" title={v.name}>
        <span className={`rounded-sm px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow ${badge[v.status] ?? "bg-line text-slate"}`}>
          {v.status}
        </span>
        {v.door === "Team Captain" && (
          <span className="rounded-sm bg-brick/10 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick">
            Captain applicant
          </span>
        )}
        {v.optedOut && (
          <span className="rounded-sm bg-brick/15 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-brick" title="Opted out of contact — do not email or text">
            ⊘ Opted out
          </span>
        )}
        {v.pledgeFulfilled && (
          <span className="rounded-sm bg-field/15 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-field" title="Donor pledge fulfilled — a matching WinRed gift has landed">
            ✓ Pledge fulfilled
          </span>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Profile */}
        <div className="card p-6">
          <p className="eyebrow text-slate">Profile</p>
          <div className="mt-2 divide-y divide-line">
            <Row label="Email" value={v.email} />
            <Row label="Phone" value={v.phone} />
            <Row label="City" value={v.city} />
            <Row label="Commitment" value={v.commitment} />
            <Row label="Roles" value={v.roles.length ? v.roles.join(", ") : null} />
            <Row label="Interests" value={v.interests} />
            <Row label="Owner" value={v.assignedTo} />
            <Row label="Last contacted" value={v.lastContactedAt ? fmt(v.lastContactedAt) : null} />
            <Row label="Signed up" value={v.createdAt ? fmt(v.createdAt) : null} />
          </div>
          {/* Notes — editable inline (was read-only). Empty submission clears them. */}
          <form action={updateVolunteerNotes} className="mt-4">
            <label htmlFor="vol-notes" className="eyebrow text-slate">Notes</label>
            <input type="hidden" name="id" value={v.id} />
            <textarea
              id="vol-notes"
              name="notes"
              defaultValue={v.notes ?? ""}
              rows={3}
              maxLength={2000}
              placeholder="Add a note about this volunteer…"
              className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field"
            />
            <button type="submit" className="btn-ghost mt-1 px-3 py-1.5 text-sm">Save notes</button>
          </form>

          {/* Controls */}
          <form action={updateVolunteer} className="mt-6 space-y-2 border-t border-line pt-5">
            <p className="eyebrow text-slate">Update</p>
            <input type="hidden" name="id" value={v.id} />
            <div className="flex items-center gap-2">
              <select name="status" aria-label="Set status" defaultValue={v.status} className="flex-1 rounded-sm border border-line bg-white px-2 py-1.5 text-sm text-ink">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">Save</button>
            </div>
            <input
              name="assignedTo"
              defaultValue={v.assignedTo ?? ""}
              placeholder="Assign owner (name/initials)"
              aria-label="Assign owner"
              className="w-full rounded-sm border border-line bg-white px-2 py-1.5 text-sm text-ink"
            />
          </form>
          <form action={markVolunteerContacted} className="mt-2">
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="current" value={v.status} />
            <button type="submit" className="text-sm font-semibold text-field hover:underline">✓ Mark contacted today</button>
          </form>

          {/* One-click captain promotion — admins only (manageTeam). Sets the captain
              RBAC role + staff row + sends the access welcome. Surfaced prominently for
              /join captain applicants, available for any volunteer with an email. */}
          {canPromote && v.email && (
            <form action={promoteToCaptain} className={`mt-4 rounded-sm border p-3 ${v.door === "Team Captain" ? "border-brick/40 bg-brick/5" : "border-line"}`}>
              <input type="hidden" name="email" value={v.email} />
              <input type="hidden" name="name" value={v.name} />
              {v.door === "Team Captain" && <p className="mb-1 text-xs font-semibold text-brick">Captain applicant — review their note above</p>}
              <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">★ Promote to Captain</button>
              <p className="mt-1 text-xs text-slate">Grants the Captain role (dashboard access) and emails them their access.</p>
            </form>
          )}

          {/* Matching profile — feeds the task-board "Suggested" assignees. */}
          <form action={updateVolunteerProfile} className="mt-6 space-y-3 border-t border-line pt-5">
            <p className="eyebrow text-slate">Matching profile</p>
            <input type="hidden" name="id" value={v.id} />
            <div className="flex gap-2">
              <input name="zip" defaultValue={v.zip ?? ""} inputMode="numeric" maxLength={5} placeholder="ZIP" aria-label="ZIP" className="w-24 rounded-sm border border-line bg-white px-2 py-1.5 text-sm text-ink" />
              <select name="mode" defaultValue={v.mode ?? ""} aria-label="Participation mode" className="flex-1 rounded-sm border border-line bg-white px-2 py-1.5 text-sm text-ink">
                <option value="">Mode — any</option>
                {VOLUNTEER_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="text-xs text-slate">Availability</legend>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {VOLUNTEER_AVAILABILITY.map((a) => (
                  <label key={a} className="flex items-center gap-1 text-xs text-ink">
                    <input type="checkbox" name="availability" value={a} defaultChecked={v.availability?.includes(a)} /> {a}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs text-slate">Skills</legend>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {VOLUNTEER_SKILLS.map((s) => (
                  <label key={s.name} className="flex items-center gap-1 text-xs text-ink">
                    <input type="checkbox" name="skills" value={s.name} defaultChecked={v.skills?.includes(s.name)} /> {s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn-ghost px-3 py-1.5 text-sm">Save profile</button>
          </form>
        </div>

        {/* Assigned tasks */}
        <div className="card h-fit p-6">
          <p className="eyebrow text-slate">Assigned tasks ({tasks.length})</p>
          {tasks.length === 0 ? (
            <p className="mt-3 text-sm text-slate">
              No tasks assigned yet. Assign one from the <Link href="/dashboard/tasks" className="text-field underline">task board</Link>.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2.5">
                  <span className={`text-sm ${t.status === "DONE" ? "text-slate line-through" : "text-ink"}`}>{t.title}</span>
                  <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
          {taskLink && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="eyebrow text-slate">Volunteer task link</p>
              <p className="mt-1 text-xs text-slate">
                Private link (no login) — send it to {v.name.split(" ")[0]} so they can view &amp; update their tasks.
              </p>
              <input
                readOnly
                value={taskLink}
                aria-label="Volunteer task link"
                className="mt-2 w-full rounded-sm border border-line bg-paper px-2 py-1.5 font-mono text-[0.7rem] text-ink"
              />
              <a href={taskLink} className="mt-1 inline-block font-mono text-xs font-semibold text-field hover:underline">Open ↗</a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
