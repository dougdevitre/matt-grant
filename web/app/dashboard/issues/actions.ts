"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  setSubmissionStatus,
  updateSubmissionText,
  deleteSubmission,
} from "@/lib/issue-board/airtable";

export type ModerationResult = { ok: boolean; message: string };

// Every action enforces TWO gates: Clerk RBAC (does this staffer have moderateIssues?) AND,
// inside the lib, the Airtable Front-End Access control table (is the op enabled for the
// dashboard audience?). Either being off blocks the write — defense in depth.
async function guard(): Promise<ModerationResult | null> {
  const { role } = await staffGate();
  if (!can(role, "moderateIssues")) return { ok: false, message: "Not allowed." };
  return null;
}

export async function approveSubmission(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing submission id." };
  try {
    await setSubmissionStatus(id, "Approved");
    revalidatePath("/dashboard/issues");
    revalidatePath("/issues"); // the public board reads Approved rows
    return { ok: true, message: "Approved — now live on the public issue board." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Approve failed." };
  }
}

export async function rejectSubmission(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing submission id." };
  try {
    await setSubmissionStatus(id, "Rejected");
    revalidatePath("/dashboard/issues");
    revalidatePath("/issues");
    return { ok: true, message: "Rejected — hidden from the public board." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Reject failed." };
  }
}

export async function editSubmission(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  const topic = String(formData.get("topic") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!id) return { ok: false, message: "Missing submission id." };
  if (!topic) return { ok: false, message: "Topic can't be empty." };
  try {
    await updateSubmissionText(id, { topic, details });
    revalidatePath("/dashboard/issues");
    revalidatePath("/issues");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function removeSubmission(
  _prev: ModerationResult | null,
  formData: FormData,
): Promise<ModerationResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing submission id." };
  try {
    await deleteSubmission(id);
    revalidatePath("/dashboard/issues");
    revalidatePath("/issues");
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
}
