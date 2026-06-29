"use server";

import { revalidatePath } from "next/cache";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { saveProfile } from "@/lib/profile";
import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listActiveCaptains, suggestCaptain } from "@/lib/volunteers/captains";
import { notifyCaptainVolunteerInterest } from "@/lib/notifications/staffNotify";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { CAMPAIGN } from "@/lib/site";

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

// A volunteer raises their hand for a matched task. Records it on their OWN record
// (so their captain/staff see it) and pings the RIGHT person: their team captain if
// they have one, else the campaign inbox so it's never lost. Self-scoped + idempotent.
export async function expressTaskInterest(formData: FormData) {
  const { email } = await staffGate();
  if (!email || !dbConfigured) return;
  const task = String(formData.get("task") ?? "").trim().slice(0, 200);
  if (!task) return;
  const sk = `e:${email.trim().toLowerCase()}`;

  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.volunteers, SK: sk } }));
  const v = r.Item;
  if (!v) return; // only an existing volunteer can express interest
  const already = (Array.isArray(v.interestedTasks) ? (v.interestedTasks as string[]) : []).some(
    (t) => t.toLowerCase() === task.toLowerCase(),
  );
  if (already) {
    revalidatePath("/community");
    return; // idempotent — don't double-record or double-notify
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.volunteers, SK: sk },
        ConditionExpression: "attribute_exists(PK)",
        UpdateExpression:
          "SET interestedTasks = list_append(if_not_exists(interestedTasks, :empty), :one), interestedAt = :now",
        ExpressionAttributeValues: { ":empty": [], ":one": [task], ":now": new Date().toISOString() },
      }),
    );
  } catch {
    return; // record gone / race — nothing to notify
  }

  const captainEmail = typeof v.captainEmail === "string" ? v.captainEmail : null;
  const name = typeof v.name === "string" ? v.name : undefined;
  if (captainEmail) {
    await notifyCaptainVolunteerInterest(captainEmail, { name, email, task }).catch(() => {});
  } else if (sesEnabled) {
    // No team yet — send to the campaign inbox so the interest isn't dropped.
    const line = `${name || "A volunteer"} (${email}) is interested in: ${task}. They haven't joined a team yet — assign them a captain.`;
    await sendEmail({
      to: CAMPAIGN.email,
      replyTo: email,
      subject: `Volunteer ready (no team yet): ${task}`.slice(0, 120),
      html: `<p>${line}</p>`,
      text: line,
    }).catch(() => {});
  }
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
