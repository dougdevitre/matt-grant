// Bridge to the campaign's "Influential Voters" table in the Master Database base — the
// no-code power-map worklist of elected officials & community leaders who received Matt's
// CHILD Protection Act mailing. The /dashboard/influencers page renders + edits the result.
//
// CRUD is GOVERNED BY AIRTABLE: the base's "Front-End Access" control table decides what the
// dashboard may do (see lib/airtable/access.ts). Today: Read + Update, with writes restricted
// to the outreach-pipeline fields via "Editable Fields" (the synced mailing data stays
// read-only). All transport goes through the shared lib/airtable/client.ts; one workspace PAT.
import {
  airtableConfigured,
  listRecords,
  updateRecords,
  type AirtableRecord,
} from "@/lib/airtable/client";
import { can, filterEditableFields } from "@/lib/airtable/access";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const BASE_ID = process.env.AIRTABLE_INFLUENCERS_BASE_ID || AIRTABLE_BASES.masterDb.id;
const TABLE_ID =
  process.env.AIRTABLE_INFLUENCERS_TABLE_ID || AIRTABLE_BASES.masterDb.tables.influentialVoters;
// Control-table row key — MUST match the "Table" cell in Front-End Access.
const TABLE_NAME = "Influential Voters";

// Field names (must match the Airtable schema). Only the outreach-pipeline fields are writable;
// the rest are display-only synced mailing data.
const FIELD = {
  name: "Name",
  title: "Title",
  org: "Organization",
  segment: "Segment",
  stage: "Outreach Stage",
  influence: "Influence Score",
  outcome: "Outcome",
  alignment: "Alignment",
  owner: "Owner",
  email: "Email",
  phone: "Phone",
  url: "Official Contact URL",
  nextAction: "Next Action",
  followUp: "Follow-up Date",
  notes: "Notes",
} as const;

export type InfluencerRow = {
  id: string;
  name: string;
  title: string;
  org: string;
  segment: string;
  stage: string;
  influence: number; // 0–5 rating
  outcome: string;
  alignment: string;
  owner: string;
  email: string;
  phone: string;
  url: string;
  nextAction: string;
  followUp: string; // YYYY-MM-DD or ""
  notes: string;
};

// The editable outreach-pipeline field option lists live in lib/influencers/edit-options.ts
// (client-safe; no server-only imports) so the client <InfluencerTable> can use them without
// dragging this server-only module into the browser bundle. Re-exported here for convenience.
export { INFLUENCER_EDIT } from "@/lib/influencers/edit-options";

export type InfluencerPatch = {
  stage?: string;
  outcome?: string;
  alignment?: string;
  owner?: string;
  nextAction?: string;
  followUp?: string; // YYYY-MM-DD or ""
  notes?: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const selName = (v: unknown): string =>
  typeof v === "string" ? v : str((v as { name?: string } | undefined)?.name);

function recordToRow(rec: AirtableRecord): InfluencerRow | null {
  const f = rec.fields;
  const name = str(f[FIELD.name]);
  if (!name) return null; // skip blank/incomplete rows
  const influenceRaw = f[FIELD.influence];
  return {
    id: rec.id,
    name,
    title: str(f[FIELD.title]),
    org: str(f[FIELD.org]),
    segment: selName(f[FIELD.segment]),
    stage: selName(f[FIELD.stage]),
    influence: typeof influenceRaw === "number" ? influenceRaw : 0,
    outcome: selName(f[FIELD.outcome]),
    alignment: selName(f[FIELD.alignment]),
    owner: str(f[FIELD.owner]),
    email: str(f[FIELD.email]),
    phone: str(f[FIELD.phone]),
    url: str(f[FIELD.url]),
    nextAction: str(f[FIELD.nextAction]),
    followUp: str(f[FIELD.followUp]).slice(0, 10),
    notes: str(f[FIELD.notes]),
  };
}

/** True when the Airtable source is configured (drives the empty-state copy). */
export async function influencersConfigured(): Promise<boolean> {
  return airtableConfigured();
}

/** True when admins have enabled dashboard Update for this table (drives edit affordances). */
export async function influencersEditable(): Promise<boolean> {
  return can("masterDb", TABLE_NAME, "dashboard", "update");
}

/**
 * All influencers, mapped + sorted by Influence Score (desc) then name. Gated by the control
 * table's dashboard Read. Returns { configured, rows }; rows is [] on missing key, disabled
 * read, or error so the page never throws. ~58 rows, well under one page. Cached ~15 min.
 */
export async function listInfluencers(): Promise<{ configured: boolean; rows: InfluencerRow[] }> {
  if (!(await airtableConfigured())) return { configured: false, rows: [] };
  if (!(await can("masterDb", TABLE_NAME, "dashboard", "read"))) return { configured: true, rows: [] };
  const records = await listRecords(BASE_ID, TABLE_ID, { pageSize: 100, revalidate: 900 });
  const rows = records
    .map(recordToRow)
    .filter((r): r is InfluencerRow => r != null)
    .sort((a, b) => b.influence - a.influence || a.name.localeCompare(b.name));
  return { configured: true, rows };
}

/**
 * Update one influencer's outreach-pipeline fields. Gated by dashboard Update AND narrowed to
 * the admin-permitted Editable Fields (so a UI bug can't write the synced mailing data). Throws
 * when disabled, nothing is permitted, or Airtable fails. Empty-string clears a field.
 */
export async function updateInfluencer(recordId: string, patch: InfluencerPatch): Promise<void> {
  if (!(await can("masterDb", TABLE_NAME, "dashboard", "update"))) {
    throw new Error("Editing influencers is disabled in Front-End Access.");
  }
  const requested: Record<string, unknown> = {};
  if (patch.stage != null) requested[FIELD.stage] = patch.stage;
  if (patch.outcome != null) requested[FIELD.outcome] = patch.outcome;
  if (patch.alignment != null) requested[FIELD.alignment] = patch.alignment;
  if (patch.owner != null) requested[FIELD.owner] = patch.owner;
  if (patch.nextAction != null) requested[FIELD.nextAction] = patch.nextAction;
  if (patch.followUp != null) requested[FIELD.followUp] = patch.followUp || null;
  if (patch.notes != null) requested[FIELD.notes] = patch.notes;
  const fields = await filterEditableFields("masterDb", TABLE_NAME, "dashboard", requested);
  if (Object.keys(fields).length === 0) {
    throw new Error("None of those fields are in the dashboard Editable Fields for this table.");
  }
  await updateRecords(BASE_ID, TABLE_ID, [{ id: recordId, fields }]);
}
