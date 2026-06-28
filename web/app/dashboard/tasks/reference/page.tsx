import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { ReferenceDataManager, type RefSection } from "@/components/dashboard/ReferenceDataManager";
import { requireCap } from "@/lib/auth";
import { REFERENCE_TABLES } from "@/lib/volunteer/reference-specs";
import { referenceConfigured, listReference, refAccess } from "@/lib/airtable/reference-data";

export const dynamic = "force-dynamic";

export default async function ReferenceDataPage() {
  await requireCap("manageVolunteers");

  const configured = await referenceConfigured();
  const sections: RefSection[] = configured
    ? await Promise.all(
        REFERENCE_TABLES.map(async (spec) => {
          const [rows, access] = await Promise.all([listReference(spec), refAccess(spec)]);
          return { spec, rows, access: { create: access.create, update: access.update, delete: access.delete } };
        }),
      )
    : [];

  return (
    <>
      <PageHeader kicker="Field plan" title="Reference data" />

      <HowTo
        steps={[
          "The lookup tables that power volunteer task matching: Roles, Skills, Commitment Levels, and the MO-02 Geo Hierarchy.",
          "Add, edit, or delete entries — changes write straight back to Airtable and feed the Task Templates’ linked-record pickers.",
          "Each table’s buttons appear only when its Create/Update/Delete is on in the Volunteer base’s Front-End Access table — no deploy to change.",
          "Links between these tables (e.g. which tasks a role bundles) are still curated in Airtable.",
        ]}
      />

      {!configured ? (
        <div className="card p-8 text-center text-slate">
          Airtable isn&apos;t connected yet. Set <span className="font-mono">AIRTABLE_API_KEY</span> (a token with
          access to the Volunteer Engagement base) to load the reference tables.
        </div>
      ) : (
        <ReferenceDataManager sections={sections} />
      )}
    </>
  );
}
