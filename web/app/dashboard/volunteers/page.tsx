import { getVolunteers } from "@/lib/queries";
import { DbNotice, HowTo, PageHeader } from "@/components/dashboard/Notice";
import { VolunteerBoard } from "@/components/dashboard/VolunteerBoard";

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
          "Filter by status or interest, or search by name, city, email, or note, to find the right people fast.",
          "Each card shows the volunteer’s stated interests and their own message. Set their status — NEW → ACTIVE once engaged, INACTIVE if they drop off — then click Save.",
          "Reach out to ACTIVE volunteers first when you staff canvasses, phone banks, and Election Day shifts.",
        ]}
      />

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-slate">
          No volunteers yet. Leads from the public <span className="font-mono">/contact</span> form land here.
        </div>
      ) : (
        <VolunteerBoard rows={rows} />
      )}
    </>
  );
}
