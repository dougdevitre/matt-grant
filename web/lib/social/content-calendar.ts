// Bridge to the campaign's Social Media base — the no-code CONTENT CALENDAR (Posts planning),
// distinct from the live publishing scheduler in lib/social/schedule.ts. Staff plan posts here
// (link a Channel / Pillar / Campaign, set status + publish date + copy); the calendar is a
// planning surface, not a publisher.
//
// CRUD is GOVERNED BY AIRTABLE: the base's "Front-End Access" control table decides what the
// dashboard may do per table (see lib/airtable/access.ts). Posts = full CRUD; the lookup tables
// (Channels / Content Pillars / Campaigns) = Read, so the editor can offer linked-record pickers.
// All transport goes through the shared lib/airtable/client.ts; one workspace PAT.
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

const BASE = AIRTABLE_BASES.socialMedia;
const T = BASE.tables;

// Control-table row keys — MUST match the "Table" cells in Front-End Access.
const NAME = {
  posts: "Posts",
  channels: "Channels",
  pillars: "Content Pillars",
  campaigns: "Campaigns",
} as const;

// Posts field names (must match the Airtable schema; also match the dashboard Editable Fields row).
const F = {
  title: "Title",
  status: "Status",
  channel: "Channel",
  pillar: "Pillar",
  campaign: "Campaign",
  publishDate: "Publish Date",
  format: "Format",
  hook: "Hook",
  body: "Body / Caption",
  cta: "CTA",
  hashtags: "Hashtags",
  approver: "Approver",
  notes: "Notes",
} as const;

/** A linked-record option for a picker: Airtable record id + its display name. */
export type LinkOption = { id: string; name: string };

export type CalendarPost = {
  id: string;
  title: string;
  status: string;
  channelIds: string[];
  pillarIds: string[];
  campaignIds: string[];
  publishDate: string; // YYYY-MM-DD or ""
  format: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  approver: string;
  notes: string;
};

// What a create/update accepts. Linked fields are arrays of Airtable record ids.
export type PostPatch = {
  title?: string;
  status?: string;
  channelIds?: string[];
  pillarIds?: string[];
  campaignIds?: string[];
  publishDate?: string;
  format?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string;
  approver?: string;
  notes?: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const selName = (v: unknown): string =>
  typeof v === "string" ? v : str((v as { name?: string } | undefined)?.name);
// Linked-record fields come back as arrays of record id strings (or {id} objects).
const linkIds = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => (typeof x === "string" ? x : str((x as { id?: string }).id))).filter(Boolean)
    : [];

function toPost(rec: AirtableRecord): CalendarPost {
  const f = rec.fields;
  return {
    id: rec.id,
    title: str(f[F.title]),
    status: selName(f[F.status]),
    channelIds: linkIds(f[F.channel]),
    pillarIds: linkIds(f[F.pillar]),
    campaignIds: linkIds(f[F.campaign]),
    publishDate: str(f[F.publishDate]).slice(0, 10),
    format: selName(f[F.format]),
    hook: str(f[F.hook]),
    body: str(f[F.body]),
    cta: str(f[F.cta]),
    hashtags: str(f[F.hashtags]),
    approver: str(f[F.approver]),
    notes: str(f[F.notes]),
  };
}

async function gate(op: CrudOp): Promise<boolean> {
  return can("socialMedia", NAME.posts, "dashboard", op);
}

/** True when the workspace token is configured (drives empty-state copy). */
export async function socialConfigured(): Promise<boolean> {
  return airtableConfigured();
}

/** True when admins have enabled dashboard Create for Posts (drives the "New post" affordance). */
export async function calendarWritable(): Promise<boolean> {
  return gate("create");
}

/** Read one lookup table into picker options ({id,name}), gated by its dashboard Read. */
async function listOptions(table: string, tableId: string, nameField: string): Promise<LinkOption[]> {
  if (!(await can("socialMedia", table, "dashboard", "read"))) return [];
  const records = await listRecords(BASE.id, tableId, { pageSize: 100, revalidate: 900 });
  return records
    .map((r) => ({ id: r.id, name: str(r.fields[nameField]) }))
    .filter((o) => o.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listChannels(): Promise<LinkOption[]> {
  return listOptions(NAME.channels, T.channels, "Channel");
}
export async function listPillars(): Promise<LinkOption[]> {
  return listOptions(NAME.pillars, T.contentPillars, "Pillar");
}
export async function listCampaigns(): Promise<LinkOption[]> {
  return listOptions(NAME.campaigns, T.campaigns, "Name");
}

/**
 * All planned posts, newest publish-date first (undated last). Gated by Posts dashboard Read;
 * returns [] when disabled/unconfigured/error so the page never throws. Cached ~5 min.
 */
export async function listCalendarPosts(): Promise<CalendarPost[]> {
  if (!(await gate("read"))) return [];
  const records = await listRecords(BASE.id, T.posts, { pageSize: 100, revalidate: 300 });
  return records.map(toPost).sort((a, b) => (b.publishDate || "").localeCompare(a.publishDate || ""));
}

// Map a PostPatch to Airtable fields, narrowed to the admin-permitted Editable Fields.
async function patchToFields(patch: PostPatch): Promise<Record<string, unknown>> {
  const requested: Record<string, unknown> = {};
  if (patch.title != null) requested[F.title] = patch.title;
  if (patch.status != null) requested[F.status] = patch.status || null;
  if (patch.channelIds != null) requested[F.channel] = patch.channelIds;
  if (patch.pillarIds != null) requested[F.pillar] = patch.pillarIds;
  if (patch.campaignIds != null) requested[F.campaign] = patch.campaignIds;
  if (patch.publishDate != null) requested[F.publishDate] = patch.publishDate || null;
  if (patch.format != null) requested[F.format] = patch.format || null;
  if (patch.hook != null) requested[F.hook] = patch.hook;
  if (patch.body != null) requested[F.body] = patch.body;
  if (patch.cta != null) requested[F.cta] = patch.cta;
  if (patch.hashtags != null) requested[F.hashtags] = patch.hashtags;
  if (patch.approver != null) requested[F.approver] = patch.approver;
  if (patch.notes != null) requested[F.notes] = patch.notes;
  return filterEditableFields("socialMedia", NAME.posts, "dashboard", requested);
}

/** Create a planned post. Gated by Posts dashboard Create. Throws on failure. Returns new id. */
export async function createCalendarPost(patch: PostPatch): Promise<string> {
  if (!(await gate("create"))) throw new Error("Creating posts is disabled in Front-End Access.");
  const fields = await patchToFields(patch);
  if (!str(fields[F.title])) throw new Error("A post needs a Title.");
  const created = await createRecords(BASE.id, T.posts, [{ fields }]);
  return created[0]?.id ?? "";
}

/** Update a planned post. Gated by Posts dashboard Update. Throws on failure. */
export async function updateCalendarPost(recordId: string, patch: PostPatch): Promise<void> {
  if (!(await gate("update"))) throw new Error("Editing posts is disabled in Front-End Access.");
  const fields = await patchToFields(patch);
  if (Object.keys(fields).length === 0) return;
  await updateRecords(BASE.id, T.posts, [{ id: recordId, fields }]);
}

/** Delete a planned post. Gated by Posts dashboard Delete. Throws on failure. */
export async function deleteCalendarPost(recordId: string): Promise<void> {
  if (!(await gate("delete"))) throw new Error("Deleting posts is disabled in Front-End Access.");
  await deleteRecords(BASE.id, T.posts, [recordId]);
}
