"use server";

import { revalidatePath } from "next/cache";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { can, type Capability } from "@/lib/rbac";
import { recordContribution } from "@/lib/donors";
import { dismissOnboarding } from "@/lib/onboarding";
import { getTaskTemplate } from "@/lib/task-templates";
import { cleanDate } from "@/lib/dashboard/due";
import { createTask, setTaskStatus as writeTaskStatus, type TaskStatus } from "@/lib/tasks";
import { mirrorVolunteerStatusToAirtable } from "@/lib/volunteers/airtable";
import { staffRole } from "@/lib/staff";
import { getVolunteer } from "@/lib/queries";
import { sendLifecycleText } from "@/lib/sms/lifecycle";

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

// Trim, coerce empty → undefined, and clamp length. The clamp is an abuse guard
// (no single free-text field — payee, notes, occupation — has a legitimate reason
// to exceed 2k chars), not a UX limit.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim().slice(0, 2000) || undefined;

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
  const r = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      ReturnValues: "ALL_NEW",
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status },
    }),
  );
  // Keep the Airtable roster's Status in sync (best-effort backend projection).
  await mirrorVolunteerStatusToAirtable((r.Attributes?.airtableId as string) ?? null, status).catch(() => {});
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
  const r = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      ReturnValues: "ALL_NEW",
      UpdateExpression: "SET #s = :s, assignedTo = :a",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status, ":a": assignedTo },
    }),
  );
  // Keep the Airtable roster's Status in sync (best-effort backend projection).
  await mirrorVolunteerStatusToAirtable((r.Attributes?.airtableId as string) ?? null, status).catch(() => {});
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

// A captain claims a volunteer onto their team (or releases them). Stores the
// captain's stable email so the "My volunteers" filter scopes reliably — distinct
// from the freeform `assignedTo` label. action=release clears the claim.
export async function setVolunteerCaptain(formData: FormData) {
  const { role, email } = await staffGate();
  if (!can(role, "manageVolunteers")) throw new Error("Forbidden");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const captainEmail = str(formData, "action") === "release" ? null : email ?? null;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: "SET captainEmail = :c",
      ExpressionAttributeValues: { ":c": captainEmail },
    }),
  );
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

// Admin assigns a volunteer to ANY captain (vs. the self-claim above). Admin-only
// (manageTeam). Validates the target is an active captain; an empty value unassigns.
export async function assignVolunteerToCaptain(formData: FormData) {
  const { role } = await staffGate();
  if (!can(role, "manageTeam")) throw new Error("Forbidden");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const chosen = (str(formData, "captainEmail") ?? "").trim().toLowerCase();
  if (chosen) {
    const r = await staffRole(chosen); // must be a real captain (or admin)
    if (r !== "captain" && r !== "admin") return;
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: "SET captainEmail = :c",
      ExpressionAttributeValues: { ":c": chosen || null },
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

// Update just the freeform notes on a volunteer (the detail page's notes editor).
// Notes are clearable, so an empty submission unsets them rather than no-op'ing.
// `notes` is aliased (#n) defensively in case it ever collides with a reserved word.
export async function updateVolunteerNotes(formData: FormData) {
  await authorize("manageVolunteers");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: "SET #n = :n",
      ExpressionAttributeNames: { "#n": "notes" },
      ExpressionAttributeValues: { ":n": notes },
    }),
  );
  revalidatePath(`/dashboard/volunteers/${id}`);
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

// Capture a volunteer's structured matching profile (ZIP, mode, skills,
// availability) used by the task-board suggester. Names aliased — "zip"/"mode"
// are DynamoDB reserved words.
export async function updateVolunteerProfile(formData: FormData) {
  await authorize("manageVolunteers");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const zip = String(formData.get("zip") ?? "").replace(/\D/g, "").slice(0, 5) || null;
  const mode = str(formData, "mode") ?? null;
  const skills = formData.getAll("skills").map(String).slice(0, 20);
  const availability = formData.getAll("availability").map(String).slice(0, 10);
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: id },
      UpdateExpression: "SET #z = :z, #m = :m, #sk = :sk, #av = :av",
      ExpressionAttributeNames: { "#z": "zip", "#m": "mode", "#sk": "skills", "#av": "availability" },
      ExpressionAttributeValues: { ":z": zip, ":m": mode, ":sk": skills, ":av": availability },
    }),
  );
  revalidatePath(`/dashboard/volunteers/${id}`);
  revalidatePath("/dashboard/volunteers");
  revalidatePath("/dashboard");
}

export async function addTask(formData: FormData) {
  await authorize("manageTasks");
  requireDb();
  let title = str(formData, "title");
  let category = str(formData, "category") ?? "Field";
  let priority = str(formData, "priority") ?? "MEDIUM";
  let detail: string | undefined;
  // Start-from-template: pull title/category/priority/detail from the Airtable
  // task-template library so a new task inherits its role/geo/effort context.
  const templateId = str(formData, "template");
  if (templateId) {
    const tpl = await getTaskTemplate(templateId);
    if (tpl) {
      title = title || tpl.name;
      category = tpl.category;
      priority = tpl.priority;
      detail = tpl.detail;
    }
  }
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
  const dueDate = cleanDate(str(formData, "dueDate")); // optional; validated to YYYY-MM-DD
  await createTask({ title, detail, category, priority, dueDate, volunteerId, volunteerName });

  // Text the assignee that they've got a task (self-gates on their SMS opt-in — no-op
  // otherwise). It logs to the 1:1 inbox, so a question reply lands where staff can see it.
  // Staff-initiated (not a confirmation of the volunteer's own action), so it respects quiet
  // hours: outside 9am–8pm CT the text is skipped rather than sent at night.
  if (volunteerId) {
    const vol = await getVolunteer(volunteerId).catch(() => null);
    if (vol?.phone) {
      await sendLifecycleText({
        to: vol.phone,
        body: `You've got a new volunteer task: ${title}. Reply here with any questions - thanks for stepping up!`,
        by: "system",
        respectQuietHours: true,
      }).catch(() => {});
    }
  }

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
  // attribute_exists guards against upserting a phantom task from a non-existent id
  // (see setTaskStatus); a missing task is a silent no-op, not a fabricated row.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.tasks, SK: id },
        UpdateExpression: "SET volunteerId = :vid, volunteerName = :vn",
        ExpressionAttributeValues: { ":vid": volunteerId, ":vn": volunteerName },
        ConditionExpression: "attribute_exists(SK)",
      }),
    );
  } catch (e) {
    if ((e as { name?: string })?.name !== "ConditionalCheckFailedException") throw e;
  }
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

// Set (or clear) a task's due date. A valid YYYY-MM-DD sets it; a blank/invalid
// value clears it (REMOVE). manageTasks-gated like the rest of the board.
export async function setTaskDueDate(formData: FormData) {
  await authorize("manageTasks");
  requireDb();
  const id = str(formData, "id");
  if (!id) return;
  const due = cleanDate(str(formData, "dueDate"));
  // attribute_exists: a non-existent id must not upsert a phantom task (see
  // setTaskStatus). Missing task → silent no-op.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.tasks, SK: id },
        ConditionExpression: "attribute_exists(SK)",
        ...(due
          ? { UpdateExpression: "SET dueDate = :d", ExpressionAttributeValues: { ":d": due } }
          : { UpdateExpression: "REMOVE dueDate" }),
      }),
    );
  } catch (e) {
    if ((e as { name?: string })?.name !== "ConditionalCheckFailedException") throw e;
  }
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function setTaskStatus(formData: FormData) {
  await authorize("manageTasks");
  requireDb();
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !status) return;
  await writeTaskStatus(id, status as TaskStatus);
  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}
