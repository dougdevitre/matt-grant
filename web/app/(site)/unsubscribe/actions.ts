"use server";

import { redirect } from "next/navigation";
import { verifyUnsubToken, setPreferences, TOPICS, isTopic } from "@/lib/subscribers";
import { setVolunteerContactOptOut } from "@/lib/volunteers/optout";

// Saves the preference center. Email is taken from the signed token, never the
// form, so one subscriber can't edit another's preferences.
export async function savePreferences(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = await verifyUnsubToken(token);
  if (!email) redirect("/unsubscribe?error=1");

  const unsubscribeAll = String(formData.get("action")) === "all";
  if (unsubscribeAll) {
    await setPreferences(email, [], true);
  } else {
    const checked = formData.getAll("subscribed").map(String).filter(isTopic);
    const optOut = TOPICS.map((t) => t.key).filter((k) => !checked.includes(k));
    await setPreferences(email, optOut, false);
  }
  // Reflect a full unsubscribe (or a re-subscribe via the prefs center) onto the
  // volunteer roster so staff don't contact someone who opted out. Best-effort.
  await setVolunteerContactOptOut({ email }, unsubscribeAll).catch(() => {});
  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&saved=1`);
}
