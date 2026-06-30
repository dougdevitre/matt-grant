import { getVolunteers, getTasks, getDonors } from "@/lib/queries";
import { emailSet } from "@/lib/engagement";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listStaff } from "@/lib/staff";
import { listMatchableTasks } from "@/lib/volunteers/task-match";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { VolunteerBoard } from "@/components/dashboard/VolunteerBoard";
import { VolunteerImport } from "@/components/dashboard/VolunteerImport";

export const dynamic = "force-dynamic"; // reads auth + DB; the board uses useSearchParams

export default async function VolunteersPage() {
  const { role, email } = await staffGate();
  const [{ connected, rows }, tasks] = await Promise.all([getVolunteers(), getTasks()]);
  // How many tasks each volunteer is assigned (for the card badge + detail link).
  const taskCounts: Record<string, number> = {};
  for (const t of tasks.rows) if (t.volunteerId) taskCounts[t.volunteerId] = (taskCounts[t.volunteerId] ?? 0) + 1;
  // Flag volunteers who have also given — only for staff allowed to see donor
  // totals (captains+admins); members never learn donor identities here.
  const donorEmails = can(role, "viewFinanceTotals") ? [...emailSet((await getDonors()).rows)] : [];
  // Active staff captains (incl. admins) so the board shows a confirmed "captain"
  // instead of "applicant" once someone's promoted. Best-effort.
  const captainEmails = (await listStaff().catch(() => []))
    .filter((s) => s.status === "active" && (s.role === "captain" || s.role === "admin"))
    .map((s) => s.email.toLowerCase());
  // Admin nudge: the /community "matched actions" only surface Active, community-
  // visible task templates. If none are Active, that feature is dark — prompt admins
  // to curate templates in Airtable. Best-effort; admins only.
  const isAdmin = can(role, "manageTeam");
  const noActiveTasks = isAdmin && connected && (await listMatchableTasks().catch(() => [])).length === 0;

  return (
    <>
      <PageHeader kicker="Field" title="Volunteers">
        {connected && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate">{rows.length} signed up</span>
            {rows.length > 0 && (
              <a href="/api/dashboard/export/volunteers" download className="btn-ghost text-xs">Export CSV</a>
            )}
          </div>
        )}
      </PageHeader>

      {!connected && <DbNotice />}

      {noActiveTasks && (
        <div className="mt-4 rounded-sm border border-gold/40 bg-gold/10 p-4">
          <p className="font-display text-sm font-semibold text-ink">Turn on matched actions for volunteers</p>
          <p className="mt-1 text-sm text-slate">
            No task templates are <span className="font-semibold">Active</span> yet, so volunteers see no
            &ldquo;your next actions&rdquo; on their community hub. In Airtable open{" "}
            <span className="font-mono">Task Templates</span> and set good ones to{" "}
            <span className="font-mono">Status = Active</span> (with <span className="font-mono">Visible To</span>{" "}
            including Supporter or Volunteer) to switch matching on.
          </p>
        </div>
      )}

      <HowTo
        steps={[
          "Leads arrive here automatically from the public /contact form — no manual entry needed.",
          "Search, filter (by status, door, role, skill, area, flags…), and sort — combine facets, save a view, or share the URL.",
          "Each card shows the volunteer’s stated interests and their own message. Set their status — NEW → ACTIVE once engaged, INACTIVE if they drop off — then click Save.",
          "Reach out to ACTIVE volunteers first when you staff canvasses, phone banks, and Election Day shifts.",
        ]}
      />

      {connected && <VolunteerImport />}

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-slate">
          No volunteers yet. Leads from the public <span className="font-mono">/contact</span> form land here — or import a list above.
        </div>
      ) : (
        <VolunteerBoard rows={rows} taskCounts={taskCounts} donorEmails={donorEmails} captainEmails={captainEmails} canViewDonors={can(role, "viewFinanceTotals")} me={email} />
      )}
    </>
  );
}
