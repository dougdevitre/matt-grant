"use server";

import { revalidatePath } from "next/cache";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured } from "@/lib/db";
import { staffGate } from "@/lib/auth";
import { saveProfile, setVoterRegistration as setVoterRegistrationProfile } from "@/lib/profile";
import { getMyVolunteerProfile } from "@/lib/volunteers/self";
import { listActiveCaptains, suggestCaptain } from "@/lib/volunteers/captains";
import { listRegions } from "@/lib/volunteers/regions";
import { buildGeoIndex } from "@/lib/volunteers/geo";
import { notifyCaptainVolunteerInterest } from "@/lib/notifications/staffNotify";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { CAMPAIGN } from "@/lib/site";
import { getShift, unclaimShiftReminder, updateShift } from "@/lib/coverage/shiftStore";

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

// Toggle the self-attested "I'm registered to vote" flag on the signed-in user's
// own profile (email from the session, never the form). Revalidates both surfaces
// the personalized summary appears on.
export async function setVoterRegistration(formData: FormData) {
  const { email } = await staffGate();
  if (!email) return;
  await setVoterRegistrationProfile(email, formData.get("registered") === "true");
  revalidatePath("/community");
  revalidatePath("/dashboard");
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
  const [captains, regions] = await Promise.all([listActiveCaptains(), listRegions()]);
  const pick = suggestCaptain({ zip: me.zip, city: me.city }, captains, buildGeoIndex(regions));
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

// ---------------------------------------------------------------------------
// Poll-shift self-signup: a volunteer takes (or drops) an open greeter shift on
// their OWN behalf. Self-scoped like everything above — the assignee identity is
// derived from the SESSION email (`e:<email>`, the volunteer record key), never
// from the form, so nobody can sign someone else up. Capacity and same-person
// checks re-run server-side against current state; the campaign-scale
// read-modify-write race on the last slot matches the admin board's.

const shiftDay = (d = new Date()) =>
  d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // YYYY-MM-DD, campaign time

/** Take one open shift. No-op (with a revalidate) on any guard failure. */
export async function claimShift(formData: FormData) {
  const { email } = await staffGate();
  if (!email || !dbConfigured) return;
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  if (!shiftId) return;

  const sk = `e:${email.trim().toLowerCase()}`;
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: PK.volunteers, SK: sk } }));
  const v = r.Item;
  if (!v) return; // only an existing volunteer can take a shift
  const name = (typeof v.name === "string" && v.name.trim()) || email.split("@")[0];

  const shift = await getShift(shiftId);
  if (!shift) return;
  if (shift.date < shiftDay()) return; // never join a past shift
  if (shift.assignees.some((a) => a.id === sk)) return; // already on it — idempotent
  if (shift.assignees.length >= shift.needed) return; // filled since the page rendered

  await updateShift(shiftId, { assignees: [...shift.assignees, { id: sk, name: name.slice(0, 80) }] }, email);
  revalidatePath("/community");
  revalidatePath("/dashboard/coverage/shifts");
}

/** Drop a shift the volunteer took (their own id only; upcoming shifts only). */
export async function dropShift(formData: FormData) {
  const { email } = await staffGate();
  if (!email || !dbConfigured) return;
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  if (!shiftId) return;

  const sk = `e:${email.trim().toLowerCase()}`;
  const shift = await getShift(shiftId);
  if (!shift || shift.date < shiftDay()) return;
  if (!shift.assignees.some((a) => a.id === sk)) return;

  await updateShift(shiftId, { assignees: shift.assignees.filter((a) => a.id !== sk) }, email);
  // Clear the reminder claim so a replacement (or a re-join) gets a fresh text.
  await unclaimShiftReminder(shiftId, sk);
  revalidatePath("/community");
  revalidatePath("/dashboard/coverage/shifts");
}
