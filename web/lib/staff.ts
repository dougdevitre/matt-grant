// DynamoDB-backed staff allowlist — lets the dashboard invite teammates at
// runtime (no redeploy). Combined with the env DASHBOARD_ALLOWLIST: a member may
// enter if their email is in the env list OR an active row here.
import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";

export type StaffMember = { email: string; name?: string; invitedBy?: string; status: "active" | "removed"; createdAt: string };
const norm = (e: string) => e.trim().toLowerCase();

export async function listStaff(): Promise<StaffMember[]> {
  if (!dbConfigured) return [];
  const r = await ddb.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.staff } }));
  return (r.Items ?? []).map((i) => ({ email: String(i.SK), name: i.name, invitedBy: i.invitedBy, status: i.status ?? "active", createdAt: i.createdAt })) as StaffMember[];
}

export async function isStaffEmail(email?: string | null): Promise<boolean> {
  if (!dbConfigured || !email) return false;
  try {
    const r = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :p AND SK = :e",
      ExpressionAttributeValues: { ":p": PK.staff, ":e": norm(email) },
    }));
    return !!r.Items?.length && r.Items[0].status !== "removed";
  } catch {
    return false;
  }
}

export async function addStaff(email: string, name: string | undefined, invitedBy: string | undefined): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { PK: PK.staff, SK: norm(email), name: name || undefined, invitedBy: invitedBy || undefined, status: "active", createdAt: new Date().toISOString() },
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
