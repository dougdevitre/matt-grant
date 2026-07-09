"use server";

import { revalidatePath } from "next/cache";
import { staffGate, isStaff } from "@/lib/auth";
import { isNotificationType } from "@/lib/notifications/types";
import { setMutedNotifications } from "@/lib/notifications/prefs";
import { toE164 } from "@/lib/sms/send";
import { recordConsent, recordOptOut } from "@/lib/sms/consent";
import { setClerkPhoneByEmail } from "@/lib/clerkRoles";
import { setVolunteerContactOptOut } from "@/lib/volunteers/optout";

export type PrefsResult = { ok: boolean; message: string };

// Save the signed-in staffer's OWN notification opt-outs. The form posts the full set of
// relevant type keys (`allTypes`) plus the ones left checked (`subscribed`); muted = the
// difference. No RBAC capability needed beyond being staff — you're editing your own prefs.
// Gate on isStaff (not gate.ok, which also admits external tiers like supporter/partner):
// notification prefs are a staff-only feature, so a non-staff caller has no business here.
export async function saveNotificationPrefs(
  _prev: PrefsResult | null,
  formData: FormData,
): Promise<PrefsResult> {
  const gate = await staffGate();
  if (!isStaff(gate) || !gate.email) return { ok: false, message: "Not signed in." };

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

export type TextAlertsState = { ok: boolean; message: string };

// Self-serve team-text opt-in (the "My text alerts" panel). This is the staffer's OWN
// action on their OWN number, which is what makes it valid TCPA consent — an admin can't
// opt a teammate in from elsewhere. We store the number on their Clerk account
// (publicMetadata.phone, so the messaging surfaces can reach them) and write the consent
// ledger row (source "staff-optin") that actually gates every send. Mirrors the inbound
// webhook's START/STOP roster branches so a staffer who is also a volunteer stays consistent.
export async function saveTextAlerts(formData: FormData): Promise<TextAlertsState> {
  const gate = await staffGate();
  if (!isStaff(gate) || !gate.email) return { ok: false, message: "Not signed in." };

  const phone = toE164(String(formData.get("phone") ?? ""));
  if (!phone) return { ok: false, message: "Enter a valid US mobile number, e.g. +13145551234." };
  const optIn = String(formData.get("optIn") ?? "") === "true";

  // Persist the number on the account either way, so it survives across visits and a later
  // re-opt-in doesn't require re-typing it.
  await setClerkPhoneByEmail(gate.email, phone);

  if (optIn) {
    const ok = await recordConsent(phone, "staff-optin");
    if (!ok) return { ok: false, message: "Couldn't save — the database isn't reachable." };
    await setVolunteerContactOptOut({ phone }, false).catch(() => {}); // clear any stale roster opt-out
    revalidatePath("/dashboard/notifications");
    return { ok: true, message: `You're opted in for team texts at ${phone}. Reply STOP to any text to opt out.` };
  }

  // Unchecked → opt out (mirrors a STOP). The number stays on file so re-opting in is one click.
  await recordOptOut(phone);
  await setVolunteerContactOptOut({ phone }, true).catch(() => {});
  revalidatePath("/dashboard/notifications");
  return { ok: true, message: `Opted out — you won't receive team texts at ${phone}.` };
}
