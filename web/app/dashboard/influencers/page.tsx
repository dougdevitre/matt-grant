import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { InfluencerTable } from "@/components/dashboard/InfluencerTable";
import { listInfluencers, influencersEditable } from "@/lib/influencers/airtable";
import { requireCap } from "@/lib/auth";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function InfluencersPage() {
  // Read-gate: must be staff with the influencer-worklist capability (not just any signed-in
  // user). Inline editing then needs the narrower manageInfluencers cap AND the control toggle.
  const { role } = await requireCap("manageTasks");
  const { configured, rows } = await listInfluencers();
  const editable = can(role, "manageInfluencers") && (await influencersEditable());

  return (
    <>
      <PageHeader kicker="Field plan" title="Influencers" />

      <HowTo
        steps={[
          "Work top-down by Influence Score — ★5 (state senators, county executive) first.",
          "Each contact is in the power-map pipeline: Warm Intro → Meeting → Ask Made → Activated.",
          "Use the Contact column to reach them; legislators without a published email link to their official contact page.",
          "Edit logs your touch right here — Stage, Outcome, Alignment, Owner, Next Action, Follow-up, Notes. The synced mailing data stays read-only.",
          "What you can edit is governed by the Master Database’s Front-End Access table — flip the Update box there to enable/disable, no deploy.",
          "Pair this with the “Influencer Follow-Up Calls” task on the Task board.",
        ]}
      />

      <p className="mb-5 max-w-prose text-sm text-slate">
        The 58 elected officials and community leaders who received Matt&apos;s CHILD Protection Act
        invitation mailing — 21 MO state senators, 26 MO House reps, and 11 St. Charles / St. Louis county
        officials. Sourced live from the campaign&apos;s Airtable <span className="font-mono">Influential Voters</span>{" "}
        table.{editable ? " Edit the outreach pipeline inline below; changes write straight back to Airtable." : " This view is read-only — edits happen in Airtable."}
      </p>

      {!configured ? (
        <div className="card p-8 text-center text-slate">
          Airtable isn&apos;t connected yet. Set <span className="font-mono">AIRTABLE_API_KEY</span> (a token with
          access to the Master Database base) to load the influencer worklist.
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-slate">
          No influencers loaded. The Airtable token may not have access to the Master Database base
          (<span className="font-mono">apptae7sUEwqFO2tX</span>) — check its scope, then refresh.
        </div>
      ) : (
        <InfluencerTable rows={rows} editable={editable} />
      )}

      <p className="mt-6 text-xs text-slate">
        Influence Score is a structural, role-based starting point (senators &amp; county executive ★5,
        state reps ★4, county council ★3) — refine per the power map. Alignment is intentionally left
        blank for the team to assess; this view never infers a contact&apos;s political disposition.
      </p>
    </>
  );
}
