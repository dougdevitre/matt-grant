// DynamoDB-backed staff allowlist — lets the dashboard invite teammates at
// runtime (no redeploy). Combined with the env DASHBOARD_ALLOWLIST: a member may
// enter if their email is in the env list OR an active row here.
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import type { Role } from "@/lib/rbac";

// Unified with the RBAC matrix (admin | captain | organizer). The DynamoDB row
// is the pending-invite store + fallback; Clerk publicMetadata.role is the
// runtime source of truth (set by the user.created webhook / team page).
export type StaffRole = Role;
export type StaffMember = { email: string; name?: string; role: StaffRole; invitedBy?: string; status: "active" | "removed"; createdAt: string };
const norm = (e: string) => e.trim().toLowerCase();

export async function listStaff(): Promise<StaffMember[]> {
  if (!dbConfigured) return [];
  const r = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.staff } }));
  return (r.Items ?? []).map((i) => ({ email: String(i.SK), name: i.name, role: (i.role as StaffRole) ?? "organizer", invitedBy: i.invitedBy, status: i.status ?? "active", createdAt: i.createdAt })) as StaffMember[];
}

// Returns the active member's role, or null if not an invited staffer.
export async function staffRole(email?: string | null): Promise<StaffRole | null> {
  if (!dbConfigured || !email) return null;
  try {
    const r = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK = :e",
      ExpressionAttributeValues: { ":p": PK.staff, ":e": norm(email) },
    }));
    const row = r.Items?.[0];
    if (!row || row.status === "removed") return null;
    return (row.role as StaffRole) ?? "organizer";
  } catch {
    return null;
  }
}

export async function addStaff(email: string, name: string | undefined, role: StaffRole, invitedBy: string | undefined): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: PK.staff, SK: norm(email), name: name || undefined, role, invitedBy: invitedBy || undefined, status: "active", createdAt: new Date().toISOString() },
  }));
}

export async function removeStaff(email: string): Promise<void> {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: PK.staff, SK: norm(email) },
    UpdateExpression: "SET #s = :r",
    ExpressionAttributeNames: { "#s": "status" },
    ExpressionAttributeValues: { ":r": "removed" },
  }));
}

// Change an existing member's role (preserves the rest of the row).
export async function setStaffRole(email: string, role: StaffRole): Promise<void> {
  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: PK.staff, SK: norm(email) },
    UpdateExpression: "SET #r = :role",
    ExpressionAttributeNames: { "#r": "role" },
    ExpressionAttributeValues: { ":role": role },
  }));
}
