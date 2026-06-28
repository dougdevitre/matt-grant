// One-way mirror: a website /join signup → the Airtable "Volunteers" table.
//
// DynamoDB stays the operational source of truth for volunteers (the dashboard
// board, matching, SMS audiences all read it). This mirror projects each signup
// into the Airtable people roster so captains/admins can filter and staff turf,
// lists, and events from the SAME no-code base — tagged in the SAME taxonomy as
// the Task Templates (Commitment Level, Role Interests, Skills, Mode, Availability,
// ZIP). That closes the people side of the matching system.
//
// Strictly BEST-EFFORT: every export swallows errors so an Airtable hiccup, a
// missing token (keyless build), or a fail-closed access rule can never block or
// fail a real signup. The lead is already saved to DynamoDB by the caller.
//
// AUTHORIZATION: gated by the base's Front-End Access control table
// (Volunteers × public → Create). If an admin unchecks Create, this no-ops.
import "server-only";
import { listRecords, createRecords, updateRecords, AirtableError } from "@/lib/airtable/client";
import { can, filterEditableFields } from "@/lib/airtable/access";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import {
  isCommitmentLevel,
  isVolunteerRole,
  isVolunteerSkill,
  isVolunteerMode,
  isAvailability,
  isJoinDoor,
  type JoinDoor,
} from "@/lib/volunteer/taxonomy";

const BASE = AIRTABLE_BASES.volunteer;
const TABLE_ID = BASE.tables.volunteers;
const TABLE_NAME = "Volunteers"; // must match the Front-End Access control row

/** The structured signup payload to mirror. All link fields are EXACT Airtable names. */
export type VolunteerMirrorInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  zip?: string | null;
  door: JoinDoor;
  commitmentLevel?: string | null; // one Commitment Levels name
  roleInterests?: string[]; // Roles names
  skills?: string[]; // Skills names
  mode?: string | null; // Participation Mode
  availability?: string[]; // Availability options
  smsOptIn?: boolean;
  pledgeAmount?: number | null;
  captainNote?: string | null;
  message?: string | null;
  source?: string | null;
  signedUpDate: string; // YYYY-MM-DD (caller stamps it — Date is not allowed in some contexts)
};

// ── name → record-id resolver for the linked lookup tables ────────────────────
// Linked-record writes need record ids, not names. We resolve via the (small,
// stable) lookup tables and cache the maps so a signup costs at most one cached
// read per table. Resolving (vs. passing names with typecast) also guarantees we
// never accidentally CREATE a stray Role/Skill/Commitment record from a typo.
type LinkTable = { tableId: string; primaryField: string };
const LINK_TABLES: Record<"commitment" | "roles" | "skills", LinkTable> = {
  commitment: { tableId: BASE.tables.commitmentLevels, primaryField: "Level" },
  roles: { tableId: BASE.tables.roles, primaryField: "Name" },
  skills: { tableId: BASE.tables.skills, primaryField: "Skill" },
};

const TTL_MS = Number(process.env.AIRTABLE_LINK_TTL_MS) || 3_600_000; // 1h — lookup tables are static
type CacheEntry = { map: Map<string, string>; expires: number };
const cache = new Map<string, CacheEntry>();

const norm = (s: string) => s.trim().toLowerCase();

/** name(lowercased) → record id for one lookup table. Empty map on any failure. */
async function nameToId(t: LinkTable): Promise<Map<string, string>> {
  const hit = cache.get(t.tableId);
  if (hit && hit.expires > Date.now()) return hit.map;
  const map = new Map<string, string>();
  try {
    const recs = await listRecords(BASE.id, t.tableId, { fields: [t.primaryField], revalidate: 3600 });
    for (const r of recs) {
      const name = r.fields[t.primaryField];
      if (typeof name === "string" && name.trim()) map.set(norm(name), r.id);
    }
  } catch {
    /* leave map empty — links are skipped, the record still gets created */
  }
  cache.set(t.tableId, { map: map, expires: Date.now() + TTL_MS });
  return map;
}

/** Resolve an array of names to record ids, dropping any that don't resolve. */
async function resolveLinks(t: LinkTable, names: string[] | undefined): Promise<string[]> {
  if (!names?.length) return [];
  const map = await nameToId(t);
  return names.map((n) => map.get(norm(n))).filter((id): id is string => Boolean(id));
}

/**
 * Upsert one signup into the Airtable Volunteers table. Pass the existing Airtable
 * record id (stored on the DynamoDB item) to UPDATE that row in place; omit it to
 * CREATE a new row. Returns the record id (so the caller can persist it for next
 * time), or null when unconfigured / not permitted / on any error. NEVER throws.
 *
 * Dedupe: the caller keys the DynamoDB volunteer by email/phone and stores the
 * returned Airtable id, so a re-submit PATCHes the same row instead of spawning a
 * duplicate. On update we do NOT touch Status or Signed Up — those are owned by the
 * dashboard (status-sync) / set once at first signup.
 */
export async function mirrorVolunteerToAirtable(
  input: VolunteerMirrorInput,
  recId?: string | null,
): Promise<string | null> {
  try {
    // Fail-closed: only write when admins have enabled public Create on this table.
    // The same gate covers the re-submit upsert — it's the same public signup path.
    if (!(await can("volunteer", TABLE_NAME, "public", "create"))) return null;

    // Validate every value against the canonical taxonomy before it leaves the app,
    // so a malformed/untrusted field can't reach Airtable.
    const door = isJoinDoor(input.door) ? input.door : "Get Updates";
    const commitmentNames = isCommitmentLevel(input.commitmentLevel) ? [input.commitmentLevel as string] : [];
    const roleNames = (input.roleInterests ?? []).filter(isVolunteerRole);
    const skillNames = (input.skills ?? []).filter(isVolunteerSkill);
    const mode = isVolunteerMode(input.mode) ? input.mode : undefined;
    const availability = (input.availability ?? []).filter(isAvailability);

    const [commitment, roles, skills] = await Promise.all([
      resolveLinks(LINK_TABLES.commitment, commitmentNames),
      resolveLinks(LINK_TABLES.roles, roleNames),
      resolveLinks(LINK_TABLES.skills, skillNames),
    ]);

    // Build the write payload keyed by FIELD NAME (so filterEditableFields, which
    // matches the control table's "Editable Fields" by name, can scope it).
    const fields: Record<string, unknown> = {
      Name: input.name,
      Door: door,
      Source: input.source || `join-${door.toLowerCase().replace(/\s+/g, "-")}`,
    };
    if (input.email) fields.Email = input.email;
    if (input.phone) fields.Phone = input.phone;
    if (input.city) fields.City = input.city;
    if (input.zip) fields.ZIP = input.zip;
    if (commitment.length) fields["Commitment Level"] = commitment;
    if (roles.length) fields["Role Interests"] = roles;
    if (skills.length) fields.Skills = skills;
    if (mode) fields["Participation Mode"] = mode;
    if (availability.length) fields.Availability = availability;
    if (input.smsOptIn) fields["SMS Opt-In"] = true;
    if (typeof input.pledgeAmount === "number" && input.pledgeAmount > 0) fields["Pledge Amount"] = input.pledgeAmount;
    if (input.captainNote) fields["Captain Note"] = input.captainNote;
    if (input.message) fields.Message = input.message;

    // Try to UPDATE the known row first. We do NOT send Status / Signed Up on an
    // update — those are admin-owned / set once at first signup.
    if (recId) {
      try {
        const scoped = await filterEditableFields("volunteer", TABLE_NAME, "public", fields);
        if (Object.keys(scoped).length === 0) return null;
        const [rec] = await updateRecords(BASE.id, TABLE_ID, [{ id: recId, fields: scoped }], true);
        return rec?.id ?? recId;
      } catch (err) {
        // If the row was deleted in Airtable the PATCH 404s — fall through to CREATE
        // so the volunteer reappears (the caller persists the fresh id). Any other
        // failure is a real error: bail without risking a duplicate.
        if (!(err instanceof AirtableError && err.status === 404)) throw err;
        console.warn("[volunteers] mirrored row gone (404) — recreating");
      }
    }

    // CREATE — set the once-only fields (Status / Signed Up) here.
    const createFields = { ...fields, Status: "New", "Signed Up": input.signedUpDate };
    const scoped = await filterEditableFields("volunteer", TABLE_NAME, "public", createFields);
    if (Object.keys(scoped).length === 0) return null;
    const [rec] = await createRecords(BASE.id, TABLE_ID, [{ fields: scoped }], true);
    return rec?.id ?? null;
  } catch (err) {
    console.warn("[volunteers] Airtable mirror failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// Dashboard status (DynamoDB) → Airtable "Status" choice. The roster only has
// New / Active / Inactive, so CONTACTED collapses to New (still being worked).
const STATUS_TO_AIRTABLE: Record<string, string> = {
  NEW: "New",
  CONTACTED: "New",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/**
 * Project a dashboard status change onto the mirrored Airtable row so captains
 * filtering the roster see current statuses. Backend plumbing (like the events
 * status mirror): the dashboard action is already RBAC-authorized, so this is NOT
 * re-gated by the Front-End Access table. Best-effort no-op without a recId.
 */
export async function mirrorVolunteerStatusToAirtable(
  recId: string | null | undefined,
  status: string,
): Promise<void> {
  if (!recId) return;
  const mapped = STATUS_TO_AIRTABLE[status];
  if (!mapped) return;
  try {
    await updateRecords(BASE.id, TABLE_ID, [{ id: recId, fields: { Status: mapped } }], true);
  } catch (err) {
    console.warn("[volunteers] Airtable status mirror failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Project an opt-out (email unsubscribe-all / SMS STOP) — or a re-subscribe — onto
 * the mirrored Airtable row's "Opted Out" checkbox, so staff working the roster
 * don't contact someone who asked not to be. Backend plumbing like the status
 * mirror; best-effort no-op without a recId.
 */
export async function mirrorVolunteerOptOutToAirtable(
  recId: string | null | undefined,
  optedOut: boolean,
): Promise<void> {
  if (!recId) return;
  try {
    await updateRecords(BASE.id, TABLE_ID, [{ id: recId, fields: { "Opted Out": optedOut } }], true);
  } catch (err) {
    console.warn("[volunteers] Airtable opt-out mirror failed:", err instanceof Error ? err.message : err);
  }
}

/** Test seam — drop the link-id caches so a test re-reads the lookup tables. */
export function _clearLinkCache(): void {
  cache.clear();
}
