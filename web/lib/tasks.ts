import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId } from "@/lib/db";

// The single write path for the task board, shared by the dashboard "Add task"
// server action (app/dashboard/actions.ts) and the extension API
// (app/api/ext/tasks). Keeping the DynamoDB write here means both callers stay in
// lockstep — the same idiom as recordContribution() shared by the donor action +
// the WinRed webhook.

// The board's lifecycle states — getOverview() (lib/queries.ts) counts exactly
// these into tasksTodo/Doing/Done, so this is the canonical status allowlist.
export const TASK_STATUSES = ["TODO", "DOING", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type NewTask = {
  title: string;
  detail?: string;
  category?: string;
  priority?: string;
  dueDate?: string; // YYYY-MM-DD (already validated by the caller)
  volunteerId?: string;
  volunteerName?: string;
};

// Create a task row (status defaults to TODO). Returns the new id. Undefined
// optional fields are dropped by the doc client (removeUndefinedValues).
export async function createTask(input: NewTask): Promise<string> {
  const id = newId();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.tasks,
        SK: id,
        title: input.title,
        detail: input.detail,
        category: input.category ?? "Field",
        priority: input.priority ?? "MEDIUM",
        status: "TODO",
        volunteerId: input.volunteerId,
        volunteerName: input.volunteerName,
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        createdAt: new Date().toISOString(),
      },
    }),
  );
  return id;
}

// Move a task to a new lifecycle status. Returns false if no task has that id.
export async function setTaskStatus(id: string, status: TaskStatus): Promise<boolean> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.tasks, SK: id },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status },
        // Update real tasks only. Without this guard an UpdateItem on a mistyped or
        // replayed id UPSERTS a phantom row holding just PK/SK/status — no title, no
        // createdAt — which getTasks renders as "undefined" and getOverview counts
        // into the board tallies. Fail closed instead of fabricating a task.
        ConditionExpression: "attribute_exists(SK)",
      }),
    );
    return true;
  } catch (e) {
    if ((e as { name?: string })?.name === "ConditionalCheckFailedException") return false;
    throw e;
  }
}
