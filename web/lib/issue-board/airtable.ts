// Bridge to the campaign's "Matt Grant for Congress - Issues" base — the moderated
// bulletin board where supporters submit the topics that matter to them.
//
// CRUD here is GOVERNED BY AIRTABLE: the base's "Front-End Access" control table decides what
// each audience may do (see lib/airtable/access.ts). Public:  create (submit) + read (Approved
// only). Dashboard: read (all) + update (Status / tidy text) + delete (spam). Flip a checkbox
// in Airtable to enable/disable any of these — no deploy. All transport goes through the shared
// lib/airtable/client.ts; the token is the one workspace PAT (getSecret("AIRTABLE_API_KEY")).
//
// Table schema (Submissions / tbl63kV5OGFj5bD6c):
//   Topic         — Single line text  (primary; the headline)
//   Details       — Long text         (why it matters; public once Approved)
//   Submitter Name— Single line text  (private)
//   City          — Single line text  (private)
//   Email         — Email             (private; follow-up only)
//   Phone         — Phone             (private)
//   SMS Opt-In    — Checkbox
//   Status        — Single select: Pending · Approved · Rejected  (new rows = Pending)
import {
  airtableConfigured,
  createRecords,
  deleteRecords,
  listRecords,
  updateRecords,
  type AirtableRecord,
} from "@/lib/airtable/client";
import { can, filterEditableFields } from "@/lib/airtable/access";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

// Base + table from the central registry; override via env if they ever move.
const BASE_ID = process.env.AIRTABLE_ISSUES_BASE_ID || AIRTABLE_BASES.issues.id;
const TABLE_ID = process.env.AIRTABLE_ISSUES_TABLE_ID || AIRTABLE_BASES.issues.tables.submissions;
// The control-table row key for this table — MUST match the "Table" cell in Front-End Access.
const TABLE_NAME = "Submissions";

// Single source of truth for the Airtable field + status names this bridge reads/writes.
const FIELD = {
  topic: "Topic",
  details: "Details",
  submitterName: "Submitter Name",
  city: "City",
  email: "Email",
  phone: "Phone",
  smsOptIn: "SMS Opt-In",
  status: "Status",
} as const;
const STATUS_PENDING = "Pending";
const STATUS_APPROVED = "Approved";

export type IssueSubmission = {
  topic: string;
  details: string;
  name?: string;
  city?: string;
  email?: string;
  phone?: string;
  smsOptIn?: boolean;
};

// What the public board renders. Deliberately omits name/city/email/phone — those stay in
// Airtable for the campaign only (submitters were told posts are anonymous).
export type PublishedTopic = {
  id: string;
  topic: string;
  details: string;
  submittedAt: string; // YYYY-MM-DD or ""
};

// What the dashboard moderation queue sees — the full private record.
export type ModerationSubmission = {
  id: string;
  topic: string;
  details: string;
  status: string;
  name: string;
  city: string;
  email: string;
  phone: string;
  smsOptIn: boolean;
  submittedAt: string;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const selName = (v: unknown): string =>
  typeof v === "string" ? v : str((v as { name?: string } | undefined)?.name);

/** True when the Airtable source is configured (drives empty-state + form copy). */
export async function issueBoardConfigured(): Promise<boolean> {
  return airtableConfigured();
}

/**
 * Write a public submission as Status="Pending". THROWS on failure (not configured, admins
 * disabled public create, bad field, Airtable down) so the server action surfaces an honest
 * error instead of silently swallowing a supporter's voice. User-supplied fields are first
 * narrowed to the admin-permitted "Editable Fields"; Status is set by the system, not the user.
 */
export async function createSubmission(s: IssueSubmission): Promise<void> {
  if (!(await can("issues", TABLE_NAME, "public", "create"))) {
    throw new Error("Issue submissions are not currently being accepted.");
  }
  const requested: Record<string, unknown> = {
    [FIELD.topic]: s.topic,
    [FIELD.details]: s.details,
    [FIELD.submitterName]: s.name || "",
    [FIELD.city]: s.city || "",
    [FIELD.email]: s.email || "",
    [FIELD.phone]: s.phone || "",
    [FIELD.smsOptIn]: Boolean(s.smsOptIn),
  };
  const fields = await filterEditableFields("issues", TABLE_NAME, "public", requested);
  fields[FIELD.status] = STATUS_PENDING; // system-set, never from the user
  await createRecords(BASE_ID, TABLE_ID, [{ fields }]);
}

/**
 * Approved topics for the public bulletin board. Gated by the control table's public Read;
 * filters to Status="Approved" server-side, newest-first, capped. Returns { configured, topics };
 * topics is [] on missing key, disabled read, or any error so the page never throws. Cached ~5 min.
 */
export async function listPublishedTopics(
  limit = 60,
): Promise<{ configured: boolean; topics: PublishedTopic[] }> {
  if (!(await airtableConfigured())) return { configured: false, topics: [] };
  if (!(await can("issues", TABLE_NAME, "public", "read"))) return { configured: true, topics: [] };
  const records = await listRecords(BASE_ID, TABLE_ID, {
    filterByFormula: `{${FIELD.status}} = '${STATUS_APPROVED}'`,
    pageSize: Math.min(limit, 100),
    maxRecords: limit,
    revalidate: 300,
  });
  const topics = records
    .map((rec): PublishedTopic | null => {
      const topic = str(rec.fields[FIELD.topic]);
      if (!topic) return null;
      return {
        id: rec.id,
        topic,
        details: str(rec.fields[FIELD.details]),
        submittedAt: (rec.createdTime ?? "").slice(0, 10),
      };
    })
    .filter((t): t is PublishedTopic => t != null)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  // Drift guard: Approved rows returned but none mapped → "Topic" field was likely renamed.
  if (records.length > 0 && topics.length === 0) {
    console.warn(
      `[issue-board] ${records.length} Approved row(s) returned but 0 mapped — ` +
        `check the "${FIELD.topic}" field name in the Airtable base.`,
    );
  }
  return { configured: true, topics };
}

function toModeration(rec: AirtableRecord): ModerationSubmission {
  const f = rec.fields;
  return {
    id: rec.id,
    topic: str(f[FIELD.topic]),
    details: str(f[FIELD.details]),
    status: selName(f[FIELD.status]) || STATUS_PENDING,
    name: str(f[FIELD.submitterName]),
    city: str(f[FIELD.city]),
    email: str(f[FIELD.email]),
    phone: str(f[FIELD.phone]),
    smsOptIn: f[FIELD.smsOptIn] === true,
    submittedAt: (rec.createdTime ?? "").slice(0, 10),
  };
}

/**
 * Full moderation queue for the dashboard (all statuses, newest-first). Gated by the control
 * table's dashboard Read. Returns [] when disabled/unconfigured — caller (a staffGate()'d page)
 * shows an empty/disabled state. Optionally filter to one status (e.g. "Pending").
 */
export async function listSubmissionsForModeration(
  status?: string,
): Promise<ModerationSubmission[]> {
  if (!(await can("issues", TABLE_NAME, "dashboard", "read"))) return [];
  const records = await listRecords(BASE_ID, TABLE_ID, {
    filterByFormula: status ? `{${FIELD.status}} = '${status}'` : undefined,
    revalidate: 0,
  });
  return records
    .map(toModeration)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Set a submission's Status (Approve/Reject/Pending). Gated by dashboard Update. Throws on failure. */
export async function setSubmissionStatus(recordId: string, status: string): Promise<void> {
  if (!(await can("issues", TABLE_NAME, "dashboard", "update"))) {
    throw new Error("Editing submissions is disabled in Front-End Access.");
  }
  const fields = await filterEditableFields("issues", TABLE_NAME, "dashboard", {
    [FIELD.status]: status,
  });
  if (Object.keys(fields).length === 0) {
    throw new Error(`"${FIELD.status}" is not in the dashboard Editable Fields for ${TABLE_NAME}.`);
  }
  await updateRecords(BASE_ID, TABLE_ID, [{ id: recordId, fields }]);
}

/** Edit a submission's public-facing text (Topic / Details). Gated by dashboard Update. */
export async function updateSubmissionText(
  recordId: string,
  patch: { topic?: string; details?: string },
): Promise<void> {
  if (!(await can("issues", TABLE_NAME, "dashboard", "update"))) {
    throw new Error("Editing submissions is disabled in Front-End Access.");
  }
  const requested: Record<string, unknown> = {};
  if (patch.topic != null) requested[FIELD.topic] = patch.topic;
  if (patch.details != null) requested[FIELD.details] = patch.details;
  const fields = await filterEditableFields("issues", TABLE_NAME, "dashboard", requested);
  if (Object.keys(fields).length === 0) return; // nothing admins permit to change
  await updateRecords(BASE_ID, TABLE_ID, [{ id: recordId, fields }]);
}

/** Delete a submission (spam removal). Gated by dashboard Delete. Throws on failure. */
export async function deleteSubmission(recordId: string): Promise<void> {
  if (!(await can("issues", TABLE_NAME, "dashboard", "delete"))) {
    throw new Error("Deleting submissions is disabled in Front-End Access.");
  }
  await deleteRecords(BASE_ID, TABLE_ID, [recordId]);
}
