import Link from "next/link";
import { notFound } from "next/navigation";
import { getVolunteer, getTasks } from "@/lib/queries";
import { PageHeader } from "@/components/dashboard/Notice";
import { updateVolunteer, markVolunteerContacted } from "@/app/dashboard/actions";

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
  const { id } = await params;
  const v = await getVolunteer(id);
  if (!v) notFound();
  const { rows: allTasks } = await getTasks();
  const tasks = allTasks.filter((t) => t.volunteerId === v.id);

  return (
    <>
      <Link href="/dashboard/volunteers" className="font-mono text-xs text-slate hover:text-ink">← All volunteers</Link>
      <PageHeader kicker="Field · Volunteer" title={v.name}>
        <span className={`rounded-sm px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow ${badge[v.status] ?? "bg-line text-slate"}`}>
          {v.status}
        </span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Profile */}
        <div className="card p-6">
          <p className="eyebrow text-slate">Profile</p>
          <div className="mt-2 divide-y divide-line">
            <Row label="Email" value={v.email} />
            <Row label="Phone" value={v.phone} />
            <Row label="City" value={v.city} />
            <Row label="Interests" value={v.interests} />
            <Row label="Owner" value={v.assignedTo} />
            <Row label="Last contacted" value={v.lastContactedAt ? fmt(v.lastContactedAt) : null} />
            <Row label="Signed up" value={v.createdAt ? fmt(v.createdAt) : null} />
          </div>
          {v.notes && (
            <p className="mt-4 rounded-sm border-l-2 border-line bg-paper px-3 py-2 text-sm italic text-slate">
              &ldquo;{v.notes}&rdquo;
            </p>
          )}

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
        </div>
      </div>
    </>
  );
}
