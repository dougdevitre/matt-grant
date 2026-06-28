"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { refSpecById } from "@/lib/volunteer/reference-specs";
import { createReference, updateReference, deleteReference } from "@/lib/airtable/reference-data";

export type RefResult = { ok: boolean; message: string };

// Two gates: Clerk RBAC (manageVolunteers) AND, inside the lib, the Airtable Front-End Access
// control table (table × dashboard CRUD) + the per-field Editable Fields allowlist.
async function guard(): Promise<RefResult | null> {
  const { role } = await staffGate();
  if (!can(role, "manageVolunteers")) return { ok: false, message: "Not allowed." };
  return null;
}

// Pull the spec's field values out of the form, keyed by each field's `key`.
function readInput(specId: string, formData: FormData): Record<string, string> {
  const spec = refSpecById(specId);
  const input: Record<string, string> = {};
  for (const f of spec?.fields ?? []) input[f.key] = String(formData.get(f.key) ?? "").trim();
  return input;
}

export async function createRef(_prev: RefResult | null, formData: FormData): Promise<RefResult> {
  const denied = await guard();
  if (denied) return denied;
  const specId = String(formData.get("specId") ?? "").trim();
  try {
    await createReference(specId, readInput(specId, formData));
    revalidatePath("/dashboard/tasks/reference");
    return { ok: true, message: "Added." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Create failed." };
  }
}

export async function updateRef(_prev: RefResult | null, formData: FormData): Promise<RefResult> {
  const denied = await guard();
  if (denied) return denied;
  const specId = String(formData.get("specId") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing record id." };
  try {
    await updateReference(specId, id, readInput(specId, formData));
    revalidatePath("/dashboard/tasks/reference");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}

export async function removeRef(_prev: RefResult | null, formData: FormData): Promise<RefResult> {
  const denied = await guard();
  if (denied) return denied;
  const specId = String(formData.get("specId") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing record id." };
  try {
    await deleteReference(specId, id);
    revalidatePath("/dashboard/tasks/reference");
    return { ok: true, message: "Deleted." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Delete failed." };
  }
}
