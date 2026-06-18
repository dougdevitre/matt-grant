"use server";

import { revalidatePath } from "next/cache";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";

function requireDb() {
  if (!dbConfigured) throw new Error("Database not connected. Set DYNAMODB_TABLE.");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || undefined;

export async function addDonor(formData: FormData) {
  requireDb();
  const name = str(formData, "name");
  if (!name) return;
  const amount = Number(formData.get("amount") ?? 0);
  const amountCents = Math.round((isFinite(amount) ? amount : 0) * 100);
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.donors,
        SK: newId(),
        name,
        email: str(formData, "email"),
        city: str(formData, "city"),
        employer: str(formData, "employer"),
        occupation: str(formData, "occupation"),
        contributions:
          amountCents > 0
            ? [{ amountCents, method: str(formData, "method") ?? "WinRed", election: "PRIMARY", receivedAt: now }]
            : [],
        createdAt: now,
      },
    }),
  );
  revalidatePath("/dashboard/donors");
  revalidatePath("/dashboard");
}

export async function addExpenditure(formData: FormData) {
  requireDb();
  const payee = str(formData, "payee");
  const amount = Number(formData.get("amount") ?? 0);
  const amountCents = Math.round((isFinite(amount) ? amount : 0) * 100);
  if (!payee || amountCents <= 0) return;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.expenditures,
        SK: newId(),
        payee,
        amountCents,
        category: str(formData, "category") ?? "Operations",
        memo: str(formData, "memo"),
        paidAt: new Date().toISOString(),
      },
    }),
  );
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard");
}

export async function updateVolunteerStatus(formData: FormData) {
  requireDb();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status },
    }),
  );
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  requireDb();
  const title = str(formData, "title");
  if (!title) return;
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.tasks,
        SK: newId(),
        title,
        category: str(formData, "category") ?? "Field",
        priority: str(formData, "priority") ?? "MEDIUM",
        status: "TODO",
        createdAt: new Date().toISOString(),
      },
    }),
  );
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function setTaskStatus(formData: FormData) {
  requireDb();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status) return;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.tasks, SK: id },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status },
    }),
  );
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}
