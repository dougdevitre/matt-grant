// Generic, spec-driven CRUD for the small "reference data" lookup tables (see reference-specs.ts).
// One implementation serves every table in REFERENCE_TABLES — read/create/update/delete are all
// governed by each base's "Front-End Access" control table (table × dashboard) and narrowed to the
// admin-permitted Editable Fields. Transport via the shared lib/airtable/client.ts; one workspace PAT.
import {
  airtableConfigured,
  listRecords,
  createRecords,
  updateRecords,
  deleteRecords,
} from "@/lib/airtable/client";
import { can, filterEditableFields, getAccess, type AccessRule } from "@/lib/airtable/access";
import { refSpecById, type RefTableSpec } from "@/lib/volunteer/reference-specs";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const baseId = (spec: RefTableSpec): string => AIRTABLE_BASES[spec.base].id;

// A generic row: the Airtable record id + a {fieldKey: value} map keyed by the spec's field keys.
export type RefRow = { id: string; values: Record<string, string> };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const selName = (v: unknown): string =>
  typeof v === "string" ? v : str((v as { name?: string } | undefined)?.name);

// Read one Airtable cell → display string, per the spec field type. Numbers render as-is; an
// Airtable percent is stored as a fraction (0–1) but shown/edited as whole percent.
function cellToString(type: string, v: unknown): string {
  if (type === "select") return selName(v);
  if (type === "number") return typeof v === "number" ? String(v) : str(v);
  if (type === "percent") return typeof v === "number" ? String(Math.round(v * 1000) / 10) : str(v);
  return str(v);
}

// Form value → Airtable cell, per type. "" clears (null). Percent: whole percent → fraction.
function valueToCell(type: string, v: string): unknown {
  if (type === "number") return v === "" ? null : Number(v);
  if (type === "percent") return v === "" ? null : Number(v) / 100;
  if (type === "select") return v || null;
  return v;
}

/** True when the workspace token is configured. */
export async function referenceConfigured(): Promise<boolean> {
  return airtableConfigured();
}

/** The control-table rule for a reference table (drives read + which buttons to show). */
export async function refAccess(spec: RefTableSpec): Promise<AccessRule> {
  return getAccess(spec.base, spec.tableName, "dashboard");
}

/**
 * All rows of a reference table, projected onto the spec's fields and sorted by the title field.
 * Gated by dashboard Read; returns [] when disabled/unconfigured/error so the page never throws.
 */
export async function listReference(spec: RefTableSpec): Promise<RefRow[]> {
  if (!(await can(spec.base, spec.tableName, "dashboard", "read"))) return [];
  const records = await listRecords(baseId(spec), spec.tableId, { pageSize: 100, revalidate: 300 });
  const titleKey = spec.fields[0].key;
  return records
    .map((rec) => {
      const values: Record<string, string> = {};
      for (const f of spec.fields) values[f.key] = cellToString(f.type, rec.fields[f.field]);
      return { id: rec.id, values };
    })
    .filter((r) => r.values[titleKey])
    .sort((a, b) => a.values[titleKey].localeCompare(b.values[titleKey]));
}

// Map raw {fieldKey: value} input → Airtable {columnName: value}, narrowed to permitted fields.
async function inputToFields(spec: RefTableSpec, input: Record<string, string>): Promise<Record<string, unknown>> {
  const requested: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (input[f.key] == null) continue;
    requested[f.field] = valueToCell(f.type, input[f.key]);
  }
  return filterEditableFields(spec.base, spec.tableName, "dashboard", requested);
}

/** Create a reference row. Gated by dashboard Create. Throws on failure. Returns new id. */
export async function createReference(specId: string, input: Record<string, string>): Promise<string> {
  const spec = refSpecById(specId);
  if (!spec) throw new Error("Unknown reference table.");
  if (!(await can(spec.base, spec.tableName, "dashboard", "create"))) {
    throw new Error(`Creating ${spec.label} is disabled in Front-End Access.`);
  }
  const fields = await inputToFields(spec, input);
  const titleCol = spec.fields[0].field;
  if (!str(fields[titleCol])) throw new Error(`${spec.fields[0].label} is required.`);
  const created = await createRecords(baseId(spec), spec.tableId, [{ fields }]);
  return created[0]?.id ?? "";
}

/** Update a reference row. Gated by dashboard Update. Throws on failure. */
export async function updateReference(specId: string, recordId: string, input: Record<string, string>): Promise<void> {
  const spec = refSpecById(specId);
  if (!spec) throw new Error("Unknown reference table.");
  if (!(await can(spec.base, spec.tableName, "dashboard", "update"))) {
    throw new Error(`Editing ${spec.label} is disabled in Front-End Access.`);
  }
  const fields = await inputToFields(spec, input);
  if (Object.keys(fields).length === 0) return;
  await updateRecords(baseId(spec), spec.tableId, [{ id: recordId, fields }]);
}

/** Delete a reference row. Gated by dashboard Delete. Throws on failure. */
export async function deleteReference(specId: string, recordId: string): Promise<void> {
  const spec = refSpecById(specId);
  if (!spec) throw new Error("Unknown reference table.");
  if (!(await can(spec.base, spec.tableName, "dashboard", "delete"))) {
    throw new Error(`Deleting ${spec.label} is disabled in Front-End Access.`);
  }
  await deleteRecords(baseId(spec), spec.tableId, [recordId]);
}
