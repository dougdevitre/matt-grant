// DynamoDB store for persisted sign placements — the durable home for the Signs
// tool's gate-verification workflow. One partition (PK.signs), SK = id uuid, like
// tasks. Only INPUT fields are stored (see persistence.ts); scoring stays derived.
import "server-only";
import { DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured, queryAllPages } from "@/lib/db";
import { batchWritePut } from "@/lib/integrations/batchWrite";
import { rawToRecord, type SignPlacementRecord } from "@/lib/signs/persistence";
import type { PlacementInput } from "@/lib/signs/placement";

/** All saved placements, oldest first. [] when the DB isn't configured or errors. */
export async function listSignPlacements(): Promise<SignPlacementRecord[]> {
  if (!dbConfigured) return [];
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.signs },
    });
    return items
      .map((it) => rawToRecord(it as Record<string, unknown>))
      .filter((r): r is SignPlacementRecord => r !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/** Persist new placements (caller has already sanitized + deduped). Returns the count written. */
export async function createSignPlacements(rows: PlacementInput[], updatedBy: string): Promise<number> {
  if (!dbConfigured || rows.length === 0) return 0;
  const now = new Date().toISOString();
  const items = rows.map((r) => ({
    PK: PK.signs,
    SK: newId(),
    ...r,
    createdAt: now,
    updatedAt: now,
    updatedBy,
  }));
  await batchWritePut(items);
  return items.length;
}

// The only fields the verification workflow may touch — gates, ownership, notes.
// Everything else (coords, scoring factors) is set at save time and stays put.
export type SignPlacementPatch = Partial<
  Pick<PlacementInput, "inDistrict" | "bufferVerified" | "propertyPermission" | "captainId" | "notes">
>;

/** Targeted update of one saved placement. False when the row doesn't exist. */
export async function updateSignPlacement(id: string, patch: SignPlacementPatch, updatedBy: string): Promise<boolean> {
  if (!dbConfigured || !id) return false;
  const sets: string[] = ["#updatedAt = :updatedAt", "#updatedBy = :updatedBy"];
  const removes: string[] = [];
  const names: Record<string, string> = { "#updatedAt": "updatedAt", "#updatedBy": "updatedBy" };
  const values: Record<string, unknown> = { ":updatedAt": new Date().toISOString(), ":updatedBy": updatedBy };
  for (const [key, value] of Object.entries(patch)) {
    names[`#${key}`] = key;
    if (value === undefined || value === "") {
      removes.push(`#${key}`);
    } else {
      sets.push(`#${key} = :${key}`);
      values[`:${key}`] = value;
    }
  }
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.signs, SK: id },
        UpdateExpression: `SET ${sets.join(", ")}${removes.length ? ` REMOVE ${removes.join(", ")}` : ""}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        // Never phantom-upsert a row that was deleted out from under the form.
        ConditionExpression: "attribute_exists(SK)",
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Hard delete (a location saved in error). The dropped table + CSV export remain the audit trail. */
export async function deleteSignPlacement(id: string): Promise<void> {
  if (!dbConfigured || !id) return;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PK.signs, SK: id } }));
}
