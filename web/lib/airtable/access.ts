// Admin-governed front-end CRUD permissions, read from each base's "Front-End Access"
// control table (registry: AIRTABLE_BASES[base].accessTable).
//
// This is the "Airtable is the source of truth" layer: campaign admins flip Create/Read/
// Update/Delete checkboxes per Table × Audience in Airtable, and the app reads them here to
// decide what the website (`public`) or staff dashboard (`dashboard`) may do — no deploy.
//
// FAIL-CLOSED by design. If the base has no control table, the row is missing, the box is
// unchecked, or the token can't read the table, `can()` returns false. The only thing that
// is ever implicitly allowed is nothing. This guards a campaign data store, so the safe
// default is "deny", not "allow".
//
// This governs WHAT an audience may do. It does NOT identify WHO the actor is — dashboard
// routes must still call staffGate() (Clerk RBAC) on top of this.
import "server-only";
import { listRecords } from "@/lib/airtable/client";
import { AIRTABLE_BASES, type BaseKey } from "@/lib/airtable/registry";

export type Audience = "public" | "dashboard";
export type CrudOp = "create" | "read" | "update" | "delete";
export type AccessRule = {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  /** Field names the front end may write on create/update. null = all fields allowed. */
  editableFields: string[] | null;
};

const DENY: AccessRule = { create: false, read: false, update: false, delete: false, editableFields: [] };

// Control-table column names (must match the Front-End Access schema). Reading by NAME (not
// id) keeps this base-agnostic — every base's control table uses the same column names.
const COL = {
  table: "Table",
  audience: "Audience",
  create: "Create",
  read: "Read",
  update: "Update",
  delete: "Delete",
  editableFields: "Editable Fields",
} as const;

const TTL_MS = Number(process.env.AIRTABLE_ACCESS_TTL_MS) || 60_000;
type CacheEntry = { rules: Map<string, AccessRule>; expires: number };
const cache = new Map<BaseKey, CacheEntry>();

const ruleKey = (table: string, audience: Audience) =>
  `${table.trim().toLowerCase()}|${audience}`;

const truthy = (v: unknown): boolean => v === true || v === 1 || v === "true";

function parseFields(v: unknown): string[] | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null; // blank = all fields allowed
  return s
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * Load and cache every access rule for a base, keyed by `${table}|${audience}`. Returns an
 * empty map (→ deny-all) when the base has no control table or the read fails.
 */
async function loadRules(base: BaseKey): Promise<Map<string, AccessRule>> {
  const hit = cache.get(base);
  if (hit && hit.expires > Date.now()) return hit.rules;

  const cfg = AIRTABLE_BASES[base];
  const accessTableId = "accessTable" in cfg ? (cfg.accessTable as string) : undefined;
  const rules = new Map<string, AccessRule>();
  if (accessTableId) {
    const records = await listRecords(cfg.id, accessTableId, { revalidate: 60 });
    for (const rec of records) {
      const f = rec.fields;
      const table = typeof f[COL.table] === "string" ? (f[COL.table] as string) : "";
      const audienceRaw = f[COL.audience];
      const audience =
        typeof audienceRaw === "string"
          ? audienceRaw
          : (audienceRaw as { name?: string } | undefined)?.name; // singleSelect → {name}
      if (!table || (audience !== "public" && audience !== "dashboard")) continue;
      rules.set(ruleKey(table, audience), {
        create: truthy(f[COL.create]),
        read: truthy(f[COL.read]),
        update: truthy(f[COL.update]),
        delete: truthy(f[COL.delete]),
        editableFields: parseFields(f[COL.editableFields]),
      });
    }
  }
  cache.set(base, { rules, expires: Date.now() + TTL_MS });
  return rules;
}

/** The full rule for a table × audience (deny-all when unconfigured/missing). */
export async function getAccess(
  base: BaseKey,
  table: string,
  audience: Audience,
): Promise<AccessRule> {
  const rules = await loadRules(base);
  return rules.get(ruleKey(table, audience)) ?? DENY;
}

/** True iff admins have enabled `op` for this table × audience. Fail-closed. */
export async function can(
  base: BaseKey,
  table: string,
  audience: Audience,
  op: CrudOp,
): Promise<boolean> {
  return (await getAccess(base, table, audience))[op];
}

/**
 * Strip a write payload down to the fields admins permit for this table × audience. When
 * editableFields is null (blank in Airtable) the payload passes through unchanged.
 */
export async function filterEditableFields(
  base: BaseKey,
  table: string,
  audience: Audience,
  fields: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { editableFields } = await getAccess(base, table, audience);
  if (editableFields == null) return fields;
  const allowed = new Set(editableFields);
  return Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.has(k)));
}

/** Test seam — drop the in-memory cache so a test (or admin re-check) re-reads Airtable. */
export function _clearAccessCache(): void {
  cache.clear();
}
