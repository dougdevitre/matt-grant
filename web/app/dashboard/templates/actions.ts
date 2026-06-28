"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can, asRole, type Role } from "@/lib/rbac";
import {
  createSavedTemplate,
  updateSavedTemplate,
  deleteSavedTemplate,
  type TemplateChannel,
} from "@/lib/notifications/messageTemplates";

export type TemplateResult = { ok: boolean; message: string };

// Curating templates = the same audience that drafts broadcasts (captains + admins).
async function guard(): Promise<TemplateResult | null> {
  const { role } = await staffGate();
  if (!can(role, "draftEmailCampaign")) return { ok: false, message: "Not allowed." };
  return null;
}

const asChannel = (v: unknown): TemplateChannel => (v === "sms" ? "sms" : "email");

// Collect the builder field values (everything except the control fields) into `vars`.
function readVars(formData: FormData): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (["id", "channel", "name", "role"].includes(k)) continue;
    vars[k] = String(v).trim();
  }
  return vars;
}

export async function createTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
  const denied = await guard();
  if (denied) return denied;
  const { email } = await staffGate();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Give the template a name." };
  const role: Role | null = asRole(formData.get("role"));
  try {
    await createSavedTemplate({ channel: asChannel(formData.get("channel")), name, role, vars: readVars(formData), createdBy: email ?? undefined });
    revalidatePath("/dashboard/templates");
    return { ok: true, message: "Template saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function updateTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
  const denied = await guard();
  if (denied) return denied;
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { ok: false, message: "Missing template id." };
  if (!name) return { ok: false, message: "Give the template a name." };
  try {
    await updateSavedTemplate(id, { name, role: asRole(formData.get("role")), vars: readVars(formData) });
    revalidatePath("/dashboard/templates");
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
    await deleteSavedTemplate(id);
    revalidatePath("/dashboard/templates");
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
}
