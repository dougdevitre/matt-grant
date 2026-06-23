"use server";

import { revalidatePath } from "next/cache";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { can, type Capability } from "@/lib/rbac";
import { recordContribution } from "@/lib/donors";
import { dismissOnboarding } from "@/lib/onboarding";

// Hide the "Start here" guide for the signed-in staffer (a per-user UI
// preference — no capability needed beyond being signed in).
export async function dismissOnboardingAction() {
  const { email } = await staffGate();
  await dismissOnboarding(email);
  revalidatePath("/dashboard");
}

function requireDb() {
  if (!dbConfigured) throw new Error("Database not connected. Set DYNAMODB_TABLE.");
}

// Server-side authorization. Hiding a form in the UI doesn't stop a crafted
// POST, so every mutating action must re-check the caller's capability here.
async function authorize(cap: Capability) {
  const { role } = await staffGate();
  if (!can(role, cap)) throw new Error("Forbidden");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || undefined;

export async function addDonor(formData: FormData) {
  await authorize("viewDonorDetail");
  requireDb();
  const name = str(formData, "name");
  if (!name) return;
  const amount = Number(formData.get("amount") ?? 0);
  // Shared recorder: email-keyed upsert into contributions[], FEC fields
  // preserved when omitted. Same path the WinRed webhook uses.
  await recordContribution({
    name,
    email: str(formData, "email"),
    city: str(formData, "city"),
    employer: str(formData, "employer"),
    occupation: str(formData, "occupation"),
    amountCents: Math.round((isFinite(amount) ? amount : 0) * 100),
    method: str(formData, "method") ?? "WinRed",
  });
  revalidatePath("/dashboard/donors");
  revalidatePath("/dashboard");
}

export async function addExpenditure(formData: FormData) {
  await authorize("editFinance");
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
  await authorize("manageVolunteers");
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

// Set status + owner together (the card's Save button). assignedTo is nullable
// so clearing the field unassigns the lead.
export async function updateVolunteer(formData: FormData) {
  await authorize("manageVolunteers");
  requireDb();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status) return;
  const assignedTo = str(formData, "assignedTo") ?? null;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: "SET #s = :s, assignedTo = :a",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status, ":a": assignedTo },
    }),
  );
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

// Stamp the last-contacted time, and advance a brand-new lead to CONTACTED
// (never downgrade an ACTIVE/INACTIVE one). `current` is the card's status.
export async function markVolunteerContacted(formData: FormData) {
  await authorize("manageVolunteers");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const bump = str(formData, "current") === "NEW";
  const now = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: bump ? "SET lastContactedAt = :t, #s = :c" : "SET lastContactedAt = :t",
      ...(bump ? { ExpressionAttributeNames: { "#s": "status" } } : {}),
      ExpressionAttributeValues: bump ? { ":t": now, ":c": "CONTACTED" } : { ":t": now },
    }),
  );
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  await authorize("manageTasks");
  requireDb();
  const title = str(formData, "title");
  if (!title) return;
  // Optional volunteer assignment: the select submits "id|name"; store both so
  // the task can show who's doing it without a join. Blank = unassigned.
  const volunteer = str(formData, "volunteer");
  let volunteerId: string | undefined;
  let volunteerName: string | undefined;
  if (volunteer) {
    const i = volunteer.indexOf("|");
    volunteerId = (i >= 0 ? volunteer.slice(0, i) : volunteer) || undefined;
    volunteerName = (i >= 0 ? volunteer.slice(i + 1) : "") || undefined;
  }
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
        volunteerId,
        volunteerName,
        createdAt: new Date().toISOString(),
      },
    }),
  );
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

// Assign (or clear) the volunteer on an existing task. value = "id|name" or "".
export async function setTaskVolunteer(formData: FormData) {
  await authorize("manageTasks");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const volunteer = str(formData, "volunteer");
  let volunteerId: string | null = null;
  let volunteerName: string | null = null;
  if (volunteer) {
    const i = volunteer.indexOf("|");
    volunteerId = (i >= 0 ? volunteer.slice(0, i) : volunteer) || null;
    volunteerName = (i >= 0 ? volunteer.slice(i + 1) : "") || null;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.tasks, SK: id },
      UpdateExpression: "SET volunteerId = :vid, volunteerName = :vn",
      ExpressionAttributeValues: { ":vid": volunteerId, ":vn": volunteerName },
    }),
  );
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function setTaskStatus(formData: FormData) {
  await authorize("manageTasks");
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
