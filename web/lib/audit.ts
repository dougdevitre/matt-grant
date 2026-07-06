import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured, queryAllPages } from "@/lib/db";

// Append-only audit trails. Each kind lives in its own partition; the sort key is
// `${ISO}#${id}` so a descending query returns newest-first chronologically.
//   • AUDIT#access  — role/access changes (who changed whose role)
//   • AUDIT#preview — admin "view as role" preview switches (self-actions), kept
//     separate so they don't clutter the access-change history.
const AUDIT_PK = "AUDIT#access";
const AUDIT_PREVIEW_PK = "AUDIT#preview";
//   • AUDIT#ext     — writes made through the extension API (/api/ext/*), so a
//     mutation from outside the dashboard UI is attributable.
const AUDIT_EXT_PK = "AUDIT#ext";

export type AuditAction = "invite" | "invite_reminder" | "role_change" | "revoke" | "preview_enter" | "preview_exit";
export type AuditEntry = {
  at: string;
  actor: string; // who acted ("system" if unknown)
  target: string; // who was affected (same as actor for self-actions like preview)
  action: AuditAction;
  role?: string; // new/assigned/previewed role
  prevRole?: string; // previous role (role_change only)
};

// Best-effort: never let an audit-write failure block the action being recorded.
async function record(pk: string, e: AuditEntry): Promise<void> {
  if (!dbConfigured) return;
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: pk, SK: `${e.at}#${newId()}`, ...e },
      }),
    );
  } catch {
    /* audit is non-critical */
  }
}

async function list(pk: string, limit: number): Promise<AuditEntry[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": pk },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );
    return (r.Items ?? []).map((i) => ({
      at: String(i.at),
      actor: String(i.actor),
      target: String(i.target),
      action: i.action as AuditAction,
      role: i.role,
      prevRole: i.prevRole,
    }));
  } catch {
    return [];
  }
}

// Role/access changes (invite, role_change, revoke).
export const recordAccessChange = (e: AuditEntry): Promise<void> => record(AUDIT_PK, e);
export const listAccessChanges = (limit = 25): Promise<AuditEntry[]> => list(AUDIT_PK, limit);

// Admin "view as role" preview switches (preview_enter, preview_exit).
export const recordPreviewSwitch = (e: AuditEntry): Promise<void> => record(AUDIT_PREVIEW_PK, e);
export const listPreviewSwitches = (limit = 25): Promise<AuditEntry[]> => list(AUDIT_PREVIEW_PK, limit);

// Writes made through the extension API. Generic (not role-shaped): `action` is a
// dotted verb like "task.create" / "task.status" and `target` is the affected
// record id. Best-effort, never blocks the write.
export type ExtAuditEntry = { at: string; actor: string; action: string; target: string };
export async function recordExtAction(e: ExtAuditEntry): Promise<void> {
  if (!dbConfigured) return;
  try {
    await ddb.send(
      new PutCommand({ TableName: TABLE, Item: { PK: AUDIT_EXT_PK, SK: `${e.at}#${newId()}`, ...e } }),
    );
  } catch {
    /* audit is non-critical */
  }
}

// Newest-first read of the extension audit trail — powers the admin "Extension
// activity" panel on /dashboard/extension. Separate from the role-shaped list()
// above because ExtAuditEntry has no role/prevRole fields. Best-effort: [] on DB
// off / error, never throws.
export async function listExtActions(limit = 25): Promise<ExtAuditEntry[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": AUDIT_EXT_PK },
        ScanIndexForward: false, // newest first
        Limit: limit,
      }),
    );
    return (r.Items ?? []).map((i) => ({
      at: String(i.at),
      actor: String(i.actor),
      action: String(i.action),
      target: String(i.target),
    }));
  } catch {
    return [];
  }
}

export type ExtActorUsage = { actor: string; count: number; lastAt: string };
export type ExtAdoptionSummary = { perActor: ExtActorUsage[]; activeLast7d: number; totalActions: number };

// Per-staffer extension adoption: groups the whole AUDIT#ext partition by actor so
// admins can see who has started using the extension (and nudge the rest). Reads all
// pages (one small partition today); best-effort empty on DB off / error. `now` is
// injectable for tests. Sorted most-recently-active first.
export async function extAdoptionSummary(now: Date = new Date()): Promise<ExtAdoptionSummary> {
  const empty: ExtAdoptionSummary = { perActor: [], activeLast7d: 0, totalActions: 0 };
  if (!dbConfigured) return empty;
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: { ":p": AUDIT_EXT_PK },
      ScanIndexForward: false,
    });
    const byActor = new Map<string, ExtActorUsage>();
    for (const i of items) {
      const actor = String(i.actor ?? "unknown");
      const at = String(i.at ?? "");
      const cur = byActor.get(actor);
      if (cur) {
        cur.count += 1;
        if (at > cur.lastAt) cur.lastAt = at;
      } else {
        byActor.set(actor, { actor, count: 1, lastAt: at });
      }
    }
    const cutoff = now.getTime() - 7 * 86_400_000;
    const perActor = [...byActor.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    const activeLast7d = perActor.filter((a) => {
      const t = Date.parse(a.lastAt);
      return Number.isFinite(t) && t >= cutoff;
    }).length;
    return { perActor, activeLast7d, totalActions: items.length };
  } catch {
    return empty;
  }
}
