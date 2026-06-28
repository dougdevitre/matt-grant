import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { TaskTemplateManager } from "@/components/dashboard/TaskTemplateManager";
import { requireCap } from "@/lib/auth";
import {
  taskTemplatesConfigured,
  taskTemplatesWritable,
  listAdminTaskTemplates,
} from "@/lib/volunteer/task-templates-admin";

export const dynamic = "force-dynamic";

export default async function TaskTemplatesPage() {
  await requireCap("manageTasks");

  const configured = await taskTemplatesConfigured();
  const [templates, editable] = configured
    ? await Promise.all([listAdminTaskTemplates(), taskTemplatesWritable()])
    : [[], false];

  return (
    <>
      <PageHeader kicker="Field plan" title="Task templates" />

      <HowTo
        steps={[
          "Curate the reusable task library here — the add-task picker on the Task board pulls the Active ones.",
          "Move a template Draft → Active to publish it to captains; Archived hides it.",
          "Create / edit / delete write straight back to the Airtable Task Templates table.",
          "Linked fields (Role, Skills, Commitment) and multi-selects (Availability, Channel, Visible To) are curated in Airtable; this editor covers the core curation fields.",
          "What this page can do is governed by the Volunteer base’s Front-End Access table — flip a checkbox there to enable/disable, no deploy.",
        ]}
      />

      <p className="mb-5 max-w-prose text-sm text-slate">
        Sourced live from the campaign&apos;s Airtable <span className="font-mono">Task Templates</span> table.
        {editable ? "" : " Read-only — turn on dashboard Create/Update/Delete for Task Templates in Front-End Access to edit here."}
      </p>

      {!configured ? (
        <div className="card p-8 text-center text-slate">
          Airtable isn&apos;t connected yet. Set <span className="font-mono">AIRTABLE_API_KEY</span> (a token with
          access to the Volunteer Engagement base) to load the template library.
        </div>
      ) : (
        <TaskTemplateManager templates={templates} editable={editable} />
      )}
    </>
  );
}
