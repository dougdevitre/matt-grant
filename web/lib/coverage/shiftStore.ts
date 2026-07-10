// DynamoDB store for poll-coverage greeter shifts — the durable home for the
// shift board behind candidate/poll-coverage-plan.md §4–§5. One partition
// (PK.pollShifts), SK = id uuid, like the signs store it mirrors. Only INPUT
// fields are stored (see shifts.ts); the grid, fill stats, and packets stay derived.
import "server-only";
import { DeleteCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured, queryAllPages } from "@/lib/db";
import { batchWritePut } from "@/lib/integrations/batchWrite";
import { rawToShift, type ShiftInput, type ShiftRecord } from "@/lib/coverage/shifts";

/** All saved shifts, oldest first. [] when the DB isn't configured or errors. */
export async function listShifts(): Promise<ShiftRecord[]> {
  if (!dbConfigured) return [];
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.pollShifts },
    });
    return items
      .map((it) => rawToShift(it as Record<string, unknown>))
      .filter((r): r is ShiftRecord => r !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

/** One saved shift by id, or null. Used by assign/unassign to read-modify-write
 *  the assignee list against current state rather than a stale form snapshot. */
export async function getShift(id: string): Promise<ShiftRecord | null> {
  if (!dbConfigured || !id) return null;
  try {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.pollShifts, SK: id } }));
    return res.Item ? rawToShift(res.Item as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Persist new shifts (caller has already sanitized + deduped). Returns the count written. */
export async function createShifts(rows: ShiftInput[], updatedBy: string): Promise<number> {
  if (!dbConfigured || rows.length === 0) return 0;
  const now = new Date().toISOString();
  const items = rows.map((r) => ({
    PK: PK.pollShifts,
    SK: newId(),
    ...r,
    createdAt: now,
    updatedAt: now,
    updatedBy,
  }));
  await batchWritePut(items);
  return items.length;
}

// The only fields the board may touch after creation — staffing and notes.
// Site/date/window are the shift's identity and stay put (delete + regenerate instead).
export type ShiftPatch = Partial<Pick<ShiftInput, "needed" | "assignees" | "notes">>;

/** Targeted update of one saved shift. False when the row doesn't exist. */
export async function updateShift(id: string, patch: ShiftPatch, updatedBy: string): Promise<boolean> {
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
        Key: { PK: PK.pollShifts, SK: id },
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

/**
 * Claim the reminder text for one assignee on one shift — true exactly once
 * (the claimNotify pattern): ADDs the id to the shift's `reminded` string set
 * under a NOT contains(...) condition, so a double-click or re-run can never
 * double-text the same person for the same shift. New assignees added after a
 * run claim fresh on the next run.
 */
export async function claimShiftReminder(id: string, assigneeId: string): Promise<boolean> {
  if (!dbConfigured || !id || !assigneeId) return false;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.pollShifts, SK: id },
        UpdateExpression: "ADD reminded :aidSet",
        ConditionExpression: "attribute_exists(SK) AND NOT contains(reminded, :aid)",
        ExpressionAttributeValues: { ":aidSet": new Set([assigneeId]), ":aid": assigneeId },
      }),
    );
    return true;
  } catch {
    return false; // already claimed (or the shift is gone)
  }
}

/**
 * Roll a reminder claim back when the text was NOT actually sent (no phone,
 * not opted in, quiet hours, transport failure) so the person is retried on a
 * later run instead of being silently lost to a fixable skip. Best-effort.
 */
export async function unclaimShiftReminder(id: string, assigneeId: string): Promise<void> {
  if (!dbConfigured || !id || !assigneeId) return;
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.pollShifts, SK: id },
        UpdateExpression: "DELETE reminded :aidSet",
        ConditionExpression: "attribute_exists(SK)",
        ExpressionAttributeValues: { ":aidSet": new Set([assigneeId]) },
      }),
    );
  } catch {
    // best-effort — worst case the person shows as reminded without a text;
    // the honest counts in the action result still surface the skip.
  }
}

/** Hard delete (a cell generated in error, e.g. a site that dropped off the list). */
export async function deleteShift(id: string): Promise<void> {
  if (!dbConfigured || !id) return;
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: PK.pollShifts, SK: id } }));
}
