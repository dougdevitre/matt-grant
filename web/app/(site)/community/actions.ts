"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { saveProfile } from "@/lib/profile";

// Save the supporter's involvement profile from the onboarding card. The email is
// taken from the authenticated session (never the form), so a supporter can only
// write their OWN profile. saveProfile validates every field, so untrusted form
// input is normalized before it's stored.
export async function saveOnboarding(formData: FormData) {
  const { email } = await staffGate();
  if (!email) return; // not signed in — the page is gated, so this is a no-op guard
  await saveProfile(email, {
    issues: formData.getAll("issues").map(String),
    waysToHelp: formData.getAll("waysToHelp").map(String),
    zip: String(formData.get("zip") ?? ""),
  });
  revalidatePath("/community");
}
