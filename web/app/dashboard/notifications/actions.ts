"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { isNotificationType } from "@/lib/notifications/types";
import { setMutedNotifications } from "@/lib/notifications/prefs";

export type PrefsResult = { ok: boolean; message: string };

// Save the signed-in staffer's OWN notification opt-outs. The form posts the full set of
// relevant type keys (`allTypes`) plus the ones left checked (`subscribed`); muted = the
// difference. No RBAC capability needed beyond being staff — you're editing your own prefs.
export async function saveNotificationPrefs(
  _prev: PrefsResult | null,
  formData: FormData,
): Promise<PrefsResult> {
  const gate = await staffGate();
  if (!gate.ok || !gate.email) return { ok: false, message: "Not signed in." };

  const allTypes = formData.getAll("allTypes").map(String).filter(isNotificationType);
  const subscribed = new Set(formData.getAll("subscribed").map(String).filter(isNotificationType));
  const muted = allTypes.filter((t) => !subscribed.has(t));

  try {
    await setMutedNotifications(gate.email, muted);
    revalidatePath("/dashboard/notifications");
    return { ok: true, message: "Saved." };
  } catch {
    return { ok: false, message: "Couldn't save — please try again." };
  }
}
