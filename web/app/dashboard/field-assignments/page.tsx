import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { ReferenceDataManager, type RefSection } from "@/components/dashboard/ReferenceDataManager";
import { requireCap } from "@/lib/auth";
import { FIELDOPS_TABLES } from "@/lib/volunteer/reference-specs";
import { referenceConfigured, listReference, refAccess } from "@/lib/airtable/reference-data";

export const dynamic = "force-dynamic";

export default async function FieldAssignmentsPage() {
  await requireCap("viewTargets");

  const configured = await referenceConfigured();
  const sections: RefSection[] = configured
    ? await Promise.all(
        FIELDOPS_TABLES.map(async (spec) => {
          const [rows, access] = await Promise.all([listReference(spec), refAccess(spec)]);
          return { spec, rows, access: { create: access.create, update: access.update, delete: access.delete } };
        }),
      )
    : [];

  return (
    <>
      <PageHeader kicker="Field plan" title="Turf & call lists" />

      <HowTo
        steps={[
          "The assignment units for voter contact: Canvass Turf (doors) and Contact Lists (phone/text).",
          "Cut a packet, set a pass type + target, and assign it — add, edit, or delete here; changes write straight to Airtable.",
          "Counts (doors/records/attempts/contacted) and turnout % are editable; the geographic Area link is curated in Airtable.",
          "Buttons appear only when each table’s Create/Update/Delete is on in the Volunteer base’s Front-End Access table — no deploy.",
        ]}
      />

      {!configured ? (
        <div className="card p-8 text-center text-slate">
          Airtable isn&apos;t connected yet. Set <span className="font-mono">AIRTABLE_API_KEY</span> (a token with
          access to the Volunteer Engagement base) to load turf &amp; call lists.
        </div>
      ) : (
        <ReferenceDataManager sections={sections} />
      )}
    </>
  );
}
