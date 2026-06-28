"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  type TaskTemplatePatch,
} from "@/lib/volunteer/task-templates-admin";

export type TemplateResult = { ok: boolean; message: string };

// Two gates: Clerk RBAC (manageTasks) AND, inside the lib, the Airtable Front-End Access control
// table (Task Templates × dashboard CRUD) + the per-field Editable Fields allowlist.
async function guard(): Promise<TemplateResult | null> {
  const { role } = await staffGate();
  if (!can(role, "manageTasks")) return { ok: false, message: "Not allowed." };
  return null;
}

function readPatch(formData: FormData): TaskTemplatePatch {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  return {
    name: get("name"),
    whatTheyDo: get("whatTheyDo"),
    status: get("status"),
    priority: get("priority"),
    mode: get("mode"),
    geo: get("geo"),
    effort: get("effort"),
    phase: get("phase"),
    pass: get("pass"),
    instructions: get("instructions"),
    script: get("script"),
  };
}

export async function createTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    await createTaskTemplate(readPatch(formData));
    revalidatePath("/dashboard/tasks/templates");
    revalidatePath("/dashboard/tasks"); // the add-task picker reads Active templates
    return { ok: true, message: "Template added." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Create failed." };
  }
}

export async function updateTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing template id." };
  try {
    await updateTaskTemplate(id, readPatch(formData));
    revalidatePath("/dashboard/tasks/templates");
    revalidatePath("/dashboard/tasks");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function removeTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing template id." };
  try {
    await deleteTaskTemplate(id);
    revalidatePath("/dashboard/tasks/templates");
    revalidatePath("/dashboard/tasks");
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
}
