"use server";

import { revalidatePath } from "next/cache";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { saveProfile } from "@/lib/profile";
import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listActiveCaptains, suggestCaptain } from "@/lib/volunteers/captains";

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

// A volunteer joins a team: auto-match them to the best captain (area, then load)
// and set the captain on their OWN record. Self-scoped (email from the session),
// idempotent (no-op if already on a team), and validates the captain is real.
export async function joinSuggestedTeam() {
  const { email } = await staffGate();
  if (!email || !dbConfigured) return;
  const me = await getMyVolunteerProfile(email);
  if (!me || me.captainEmail) return; // not a volunteer, or already on a team
  const captains = await listActiveCaptains();
  const pick = suggestCaptain({ zip: me.zip, city: me.city }, captains);
  if (!pick) return; // no captains available yet
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: PK.volunteers, SK: `e:${email.trim().toLowerCase()}` },
      ConditionExpression: "attribute_exists(PK)",
      UpdateExpression: "SET captainEmail = :c, joinedTeamAt = :t",
      ExpressionAttributeValues: { ":c": pick.email, ":t": new Date().toISOString() },
    }),
  );
  revalidatePath("/community");
}
