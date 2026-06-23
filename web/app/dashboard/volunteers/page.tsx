import { getVolunteers, getTasks } from "@/lib/queries";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { VolunteerBoard } from "@/components/dashboard/VolunteerBoard";
import { VolunteerImport } from "@/components/dashboard/VolunteerImport";

export default async function VolunteersPage() {
  const [{ connected, rows }, tasks] = await Promise.all([getVolunteers(), getTasks()]);
  // How many tasks each volunteer is assigned (for the card badge + detail link).
  const taskCounts: Record<string, number> = {};
  for (const t of tasks.rows) if (t.volunteerId) taskCounts[t.volunteerId] = (taskCounts[t.volunteerId] ?? 0) + 1;

  return (
    <>
      <PageHeader kicker="Field" title="Volunteers">
        {connected && <span className="font-mono text-sm text-slate">{rows.length} signed up</span>}
      </PageHeader>

      {!connected && <DbNotice />}

      <HowTo
        steps={[
          "Leads arrive here automatically from the public /contact form — no manual entry needed.",
          "Filter by status or interest, or search by name, city, email, or note, to find the right people fast.",
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
        <VolunteerBoard rows={rows} taskCounts={taskCounts} />
      )}
    </>
  );
}
