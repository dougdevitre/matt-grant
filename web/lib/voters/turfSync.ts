// Airtable sync for the voter-file walk turfs → the "Canvass Turf" table (and the
// matched-phone call list → "Contact Lists") in the Volunteer Engagement base —
// closing voter-file-plan.md Phase 4's "counts stay manual" gap.
//
// PRIVACY BOUNDARY: only assignment-unit SUMMARIES cross into Airtable — turf
// name, door/voter counts, captain, notes. The walk list itself (names,
// addresses — RSMo 115.157 data) NEVER leaves the app; captains get it as the
// printed packet.
//
// AUTHORIZATION: every write is gated by the base's Front-End Access control
// table (Canvass Turf / Contact Lists × dashboard) — fail-closed, admin-flippable
// without a deploy — on top of the caller's viewVoterFile RBAC gate.
//
// Upsert by deterministic name so a re-sync UPDATES rows instead of duplicating.
// On update only the app-owned numbers/captain/notes change — Walk Status,
// Priority, and the Area link are field-team/Airtable-curated after creation
// (the volunteers-mirror precedent).
import "server-only";
import { listRecords, createRecords, updateRecords, AirtableNotConfiguredError } from "@/lib/airtable/client";
import { can, filterEditableFields } from "@/lib/airtable/access";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

const BASE = AIRTABLE_BASES.volunteer;

export type TurfSummary = {
  index: number;
  total: number;
  doors: number;
  voters: number;
  captainName?: string;
};

export type SyncResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; reason: string };

/** Deterministic row name — the upsert key. */
export const turfName = (precinctLabel: string, index: number, total: number) =>
  `${precinctLabel} · Turf ${index}/${total}`;
export const callListName = (precinctLabel: string) => `${precinctLabel} · matched phones`;

const note = (filtersLabel: string) =>
  `Generated from /dashboard/voters · ${filtersLabel} · the walk/call list itself stays in the app (RSMo 115.157 — counts only here).`;

type Row = { fields: Record<string, unknown> };

/** Map existing rows' primary-field value → record id (single list pass). */
async function existingByName(tableId: string, primaryField: string): Promise<Map<string, string>> {
  const recs = await listRecords(BASE.id, tableId, { fields: [primaryField] });
  const map = new Map<string, string>();
  for (const r of recs) {
    const name = r.fields[primaryField];
    if (typeof name === "string" && name.trim()) map.set(name.trim(), r.id);
  }
  return map;
}

const chunk10 = <T,>(rows: T[]): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += 10) out.push(rows.slice(i, i + 10));
  return out;
};

async function upsert(
  tableId: string,
  tableName: string,
  primaryField: string,
  rows: { name: string; createFields: Record<string, unknown>; updateFields: Record<string, unknown> }[],
): Promise<SyncResult> {
  try {
    const [mayCreate, mayUpdate] = await Promise.all([
      can("volunteer", tableName, "dashboard", "create"),
      can("volunteer", tableName, "dashboard", "update"),
    ]);
    if (!mayCreate && !mayUpdate) {
      return { ok: false, reason: `Airtable admins haven't enabled dashboard writes to ${tableName} (Front-End Access table).` };
    }
    const byName = await existingByName(tableId, primaryField);
    const creates: Row[] = [];
    const updates: { id: string; fields: Record<string, unknown> }[] = [];
    for (const r of rows) {
      const id = byName.get(r.name);
      if (id && mayUpdate) {
        const fields = await filterEditableFields("volunteer", tableName, "dashboard", r.updateFields);
        if (Object.keys(fields).length) updates.push({ id, fields });
      } else if (!id && mayCreate) {
        const fields = await filterEditableFields("volunteer", tableName, "dashboard", r.createFields);
        if (Object.keys(fields).length) creates.push({ fields });
      }
    }
    for (const batch of chunk10(creates)) await createRecords(BASE.id, tableId, batch, true);
    for (const batch of chunk10(updates)) await updateRecords(BASE.id, tableId, batch, true);
    return { ok: true, created: creates.length, updated: updates.length };
  } catch (err) {
    if (err instanceof AirtableNotConfiguredError) return { ok: false, reason: "Airtable isn't configured (no API key)." };
    const msg = err instanceof Error ? err.message : "unknown error";
    return { ok: false, reason: `Airtable sync failed: ${msg}` };
  }
}

/** Upsert the cut turfs (SUMMARIES only) into Canvass Turf. */
export async function syncTurfs(input: {
  precinctLabel: string;
  filtersLabel: string;
  turfs: TurfSummary[];
}): Promise<SyncResult> {
  const rows = input.turfs.map((t) => {
    const name = turfName(input.precinctLabel, t.index, t.total);
    const shared = {
      Doors: t.doors,
      "Registered Voters": t.voters,
      "Assigned Captain": t.captainName ?? "",
      Notes: note(input.filtersLabel),
    };
    return {
      name,
      createFields: {
        "Turf Name": name,
        "Pass Type": "Voter ID",
        "Walk Status": t.captainName ? "Assigned" : "Unassigned",
        ...shared,
      },
      // Walk Status / Priority / Pass Type / Area are Airtable-curated after creation.
      updateFields: shared,
    };
  });
  return upsert(BASE.tables.canvassTurf, "Canvass Turf", "Turf Name", rows);
}

/** Upsert the matched-phone call list (COUNT only) into Contact Lists. */
export async function syncCallList(input: {
  precinctLabel: string;
  filtersLabel: string;
  records: number;
}): Promise<SyncResult> {
  const name = callListName(input.precinctLabel);
  const shared = { Records: input.records, Notes: note(input.filtersLabel) };
  return upsert(BASE.tables.contactLists, "Contact Lists", "List Name", [
    {
      name,
      createFields: {
        "List Name": name,
        Channel: "Phone",
        "Pass Type": "Voter ID",
        Status: "Unassigned",
        ...shared,
      },
      updateFields: shared,
    },
  ]);
}
