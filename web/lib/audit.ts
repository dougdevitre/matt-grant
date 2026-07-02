import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";

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
