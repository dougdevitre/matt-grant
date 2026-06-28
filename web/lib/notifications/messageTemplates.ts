// Phase 3b — admin-saved, role-tagged message templates for the email/SMS composers.
//
// A saved template is just stored COPY + a default audience role. It rides the existing generic
// send paths (no new sender): an email template maps onto the "announcement" broadcast, an SMS
// template onto the "custom" SMS template. So `vars` holds that builder's field values. Picking a
// saved template in a composer prefills those fields + pre-selects the tagged role.
//
// Stored in its own DynamoDB partition (PK.msgTemplates, SK = id). The TYPE is import-safe from
// the client (type-only); the functions are server-only (DynamoDB).
import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { asRole, type Role } from "@/lib/rbac";

export type TemplateChannel = "email" | "sms";
export type SavedTemplate = {
  id: string;
  channel: TemplateChannel;
  name: string;
  role: Role | null; // default audience role (pre-selected in the composer); null = none
  vars: Record<string, string>; // values for the announcement (email) / custom (sms) builder fields
  createdAt: string;
  createdBy?: string;
};

function toTemplate(it: Record<string, unknown>): SavedTemplate {
  return {
    id: String(it.SK),
    channel: it.channel === "sms" ? "sms" : "email",
    name: String(it.name ?? ""),
    role: asRole(it.role),
    vars: (it.vars && typeof it.vars === "object" ? (it.vars as Record<string, string>) : {}),
    createdAt: String(it.createdAt ?? ""),
    createdBy: it.createdBy ? String(it.createdBy) : undefined,
  };
}

/** All saved templates (optionally filtered to one channel), newest first. [] when unconfigured. */
export async function listSavedTemplates(channel?: TemplateChannel): Promise<SavedTemplate[]> {
  if (!dbConfigured) return [];
  try {
    const r = await ddb.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": PK.msgTemplates } }),
    );
    let rows = (r.Items ?? []).map(toTemplate).filter((t) => t.name);
    if (channel) rows = rows.filter((t) => t.channel === channel);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function createSavedTemplate(input: {
  channel: TemplateChannel;
  name: string;
  role: Role | null;
  vars: Record<string, string>;
  createdBy?: string;
}): Promise<string> {
  const id = newId();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.msgTemplates,
        SK: id,
        channel: input.channel,
        name: input.name,
        role: input.role ?? undefined,
        vars: input.vars,
        createdBy: input.createdBy || undefined,
        createdAt: new Date().toISOString(),
      },
    }),
  );
  return id;
}

export async function updateSavedTemplate(
  id: string,
  patch: { name?: string; role?: Role | null; vars?: Record<string, string> },
): Promise<void> {
  const sets: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  if (patch.name != null) { sets.push("#n = :n"); names["#n"] = "name"; values[":n"] = patch.name; }
  if (patch.role !== undefined) { sets.push("#r = :r"); names["#r"] = "role"; values[":r"] = patch.role ?? null; }
  if (patch.vars != null) { sets.push("vars = :v"); values[":v"] = patch.vars; }
  if (!sets.length) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.msgTemplates, SK: id },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function deleteSavedTemplate(id: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PK.msgTemplates, SK: id } }));
}
