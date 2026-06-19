"use server";

import { redirect } from "next/navigation";
import { verifyUnsubToken, setPreferences, TOPICS, isTopic } from "@/lib/subscribers";

// Saves the preference center. Email is taken from the signed token, never the
// form, so one subscriber can't edit another's preferences.
export async function savePreferences(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const email = verifyUnsubToken(token);
  if (!email) redirect("/unsubscribe?error=1");

  if (String(formData.get("action")) === "all") {
    await setPreferences(email, [], true);
  } else {
    const checked = formData.getAll("subscribed").map(String).filter(isTopic);
    const optOut = TOPICS.map((t) => t.key).filter((k) => !checked.includes(k));
    await setPreferences(email, optOut, false);
  }
  redirect(`/unsubscribe?token=${encodeURIComponent(token)}&saved=1`);
}
