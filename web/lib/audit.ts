import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, newId, dbConfigured } from "@/lib/db";

// Append-only audit trail for access/role changes: who changed whose role, when.
// Stored under one partition; the sort key is `${ISO}#${id}` so a descending
// query returns newest-first chronologically.
const AUDIT_PK = "AUDIT#access";

export type AuditAction = "invite" | "role_change" | "revoke";
export type AuditEntry = {
  at: string;
  actor: string; // admin who made the change ("system" if unknown)
  target: string; // member whose access changed
  action: AuditAction;
  role?: string; // new/assigned role
  prevRole?: string; // previous role (role_change only)
};

// Best-effort: never let an audit-write failure block the actual access change.
export async function recordAccessChange(e: AuditEntry): Promise<void> {
  if (!dbConfigured) return;
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { PK: AUDIT_PK, SK: `${e.at}#${newId()}`, ...e },
      }),
    );
  } catch {
    /* audit is non-critical */
  }
}

export async function listAccessChanges(limit = 25): Promise<AuditEntry[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :p",
        ExpressionAttributeValues: { ":p": AUDIT_PK },
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
