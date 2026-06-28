"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { updateInfluencer, type InfluencerPatch } from "@/lib/influencers/airtable";

export type InfluencerEditResult = { ok: boolean; message: string };

// Two gates: Clerk RBAC (manageInfluencers) AND, inside the lib, the Airtable Front-End Access
// control table (dashboard Update on Influential Voters) + the per-field Editable Fields allowlist.
export async function saveInfluencer(
  _prev: InfluencerEditResult | null,
  formData: FormData,
): Promise<InfluencerEditResult> {
  const { role } = await staffGate();
  if (!can(role, "manageInfluencers")) return { ok: false, message: "Not allowed." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, message: "Missing record id." };

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const patch: InfluencerPatch = {
    stage: get("stage"),
    outcome: get("outcome"),
    alignment: get("alignment"),
    owner: get("owner"),
    nextAction: get("nextAction"),
    followUp: get("followUp"),
    notes: get("notes"),
  };

  try {
    await updateInfluencer(id, patch);
    revalidatePath("/dashboard/influencers");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}
