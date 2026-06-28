// Dashboard MANAGER for the Volunteer base "Task Templates" library — full CRUD on the curation
// fields, governed by the base's "Front-End Access" control table (Task Templates × dashboard).
//
// Distinct from lib/task-templates.ts, which is the read-only PICKER feed for the /dashboard/tasks
// add-task form (a simplified projection). This module is the rich edit surface used by
// /dashboard/tasks/templates. Linked fields (Role/Skills/Commitment) and multi-selects
// (Availability/Channel/Visible To) are intentionally NOT edited here — they're curated in
// Airtable — so the Editable Fields control row lists only the scalar curation fields.
import {
  airtableConfigured,
  listRecords,
  createRecords,
  updateRecords,
  deleteRecords,
  type AirtableRecord,
} from "@/lib/airtable/client";
import { can, filterEditableFields, type CrudOp } from "@/lib/airtable/access";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const BASE = AIRTABLE_BASES.volunteer;
const TABLE_ID = BASE.tables.taskTemplates;
const TABLE_NAME = "Task Templates"; // MUST match the control-table "Table" cell

const F = {
  name: "Task Name",
  whatTheyDo: "What They Do",
  status: "Status",
  priority: "Priority",
  mode: "Participation Mode",
  geo: "Geo Scope",
  effort: "Effort",
  phase: "Campaign Phase",
  pass: "Contact Pass Type",
  instructions: "Instructions",
  script: "Script / Talking Points",
} as const;

export type AdminTaskTemplate = {
  id: string;
  name: string;
  whatTheyDo: string;
  status: string;
  priority: string;
  mode: string;
  geo: string;
  effort: string;
  phase: string;
  pass: string;
  instructions: string;
  script: string;
};

export type TaskTemplatePatch = Partial<Omit<AdminTaskTemplate, "id">>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const selName = (v: unknown): string =>
  typeof v === "string" ? v : str((v as { name?: string } | undefined)?.name);

function toTemplate(rec: AirtableRecord): AdminTaskTemplate {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f[F.name]),
    whatTheyDo: str(f[F.whatTheyDo]),
    status: selName(f[F.status]),
    priority: selName(f[F.priority]),
    mode: selName(f[F.mode]),
    geo: selName(f[F.geo]),
    effort: selName(f[F.effort]),
    phase: selName(f[F.phase]),
    pass: selName(f[F.pass]),
    instructions: str(f[F.instructions]),
    script: str(f[F.script]),
  };
}

async function gate(op: CrudOp): Promise<boolean> {
  return can("volunteer", TABLE_NAME, "dashboard", op);
}

/** True when the workspace token is configured (drives empty-state copy). */
export async function taskTemplatesConfigured(): Promise<boolean> {
  return airtableConfigured();
}

/** True when admins have enabled dashboard Create (drives the "New template" affordance). */
export async function taskTemplatesWritable(): Promise<boolean> {
  return gate("create");
}

/**
 * All templates (every status), sorted by status then name. Gated by dashboard Read; returns []
 * when disabled/unconfigured/error so the page never throws. Cached ~5 min.
 */
export async function listAdminTaskTemplates(): Promise<AdminTaskTemplate[]> {
  if (!(await gate("read"))) return [];
  const records = await listRecords(BASE.id, TABLE_ID, { pageSize: 100, revalidate: 300 });
  const rank: Record<string, number> = { Active: 0, Draft: 1, Archived: 2 };
  return records
    .map(toTemplate)
    .filter((t) => t.name)
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.name.localeCompare(b.name));
}

async function patchToFields(patch: TaskTemplatePatch): Promise<Record<string, unknown>> {
  const requested: Record<string, unknown> = {};
  if (patch.name != null) requested[F.name] = patch.name;
  if (patch.whatTheyDo != null) requested[F.whatTheyDo] = patch.whatTheyDo;
  if (patch.status != null) requested[F.status] = patch.status || null;
  if (patch.priority != null) requested[F.priority] = patch.priority || null;
  if (patch.mode != null) requested[F.mode] = patch.mode || null;
  if (patch.geo != null) requested[F.geo] = patch.geo || null;
  if (patch.effort != null) requested[F.effort] = patch.effort || null;
  if (patch.phase != null) requested[F.phase] = patch.phase || null;
  if (patch.pass != null) requested[F.pass] = patch.pass || null;
  if (patch.instructions != null) requested[F.instructions] = patch.instructions;
  if (patch.script != null) requested[F.script] = patch.script;
  return filterEditableFields("volunteer", TABLE_NAME, "dashboard", requested);
}

/** Create a template. Gated by dashboard Create. Throws on failure. Returns new id. */
export async function createTaskTemplate(patch: TaskTemplatePatch): Promise<string> {
  if (!(await gate("create"))) throw new Error("Creating templates is disabled in Front-End Access.");
  const fields = await patchToFields(patch);
  if (!str(fields[F.name])) throw new Error("A template needs a Task Name.");
  const created = await createRecords(BASE.id, TABLE_ID, [{ fields }]);
  return created[0]?.id ?? "";
}

/** Update a template. Gated by dashboard Update. Throws on failure. */
export async function updateTaskTemplate(recordId: string, patch: TaskTemplatePatch): Promise<void> {
  if (!(await gate("update"))) throw new Error("Editing templates is disabled in Front-End Access.");
  const fields = await patchToFields(patch);
  if (Object.keys(fields).length === 0) return;
  await updateRecords(BASE.id, TABLE_ID, [{ id: recordId, fields }]);
}

/** Delete a template. Gated by dashboard Delete. Throws on failure. */
export async function deleteTaskTemplate(recordId: string): Promise<void> {
  if (!(await gate("delete"))) throw new Error("Deleting templates is disabled in Front-End Access.");
  await deleteRecords(BASE.id, TABLE_ID, [recordId]);
}
