"use server";

import { revalidatePath } from "next/cache";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { verifyVolunteerToken } from "@/lib/volunteer-link";

// Volunteer-side task update via a signed magic link (no login). The token IS
// the auth: it must verify AND the task must belong to that volunteer. Only the
// volunteer-safe transitions are allowed (accept → DOING, finish → DONE); a
// crafted POST can't move someone else's task or set an arbitrary status.
const ALLOWED = new Set(["DOING", "DONE"]);

export async function volunteerSetTaskStatus(formData: FormData) {
  if (!dbConfigured) return;
  const token = String(formData.get("token") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!taskId || !ALLOWED.has(status)) return;

  const volunteerId = await verifyVolunteerToken(token);
  if (!volunteerId) return;

  // Ownership check — the task must be assigned to this volunteer.
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.tasks, SK: taskId } }));
  if (!r.Item || r.Item.volunteerId !== volunteerId) return;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.tasks, SK: taskId },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status },
    }),
  );
  revalidatePath(`/my-tasks/${token}`);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}
