"use server";

import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, newId, dbConfigured } from "@/lib/db";
import { sendEmail, sesEnabled } from "@/lib/email/send";
import { volunteerWelcome, supporterWelcome, contactReceipt } from "@/lib/email/templates";
import { CAMPAIGN } from "@/lib/site";
import { toE164 } from "@/lib/sms/send";
import { recordConsent } from "@/lib/sms/consent";
import { saveProfile, cleanZip, type WayToHelp } from "@/lib/profile";
import { mirrorVolunteerToAirtable } from "@/lib/volunteers/airtable";
import { notifyAdminsCaptainApplication, notifyCaptainsNewVolunteer } from "@/lib/notifications/staffNotify";
import {
  isCommitmentLevel,
  isVolunteerRole,
  isVolunteerSkill,
  isVolunteerMode,
  isAvailability,
  isJoinDoor,
  type JoinDoor,
} from "@/lib/volunteer/taxonomy";

// The single intake path for every /join door. The dashboard's DynamoDB store
// stays the operational source of truth (the board + matcher read it); this also
// saves the supporter profile, records SMS consent, mirrors to the Airtable
// Volunteers roster, and sends a branded welcome. Every side effect beyond the
// core DynamoDB write is best-effort and never fails the signup.

export type VolunteerIntake = {
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  zip?: string | null;
  door: JoinDoor;
  commitmentLevel?: string | null;
  roleInterests?: string[];
  skills?: string[];
  mode?: string | null;
  availability?: string[];
  smsOptIn?: boolean;
  pledgeAmount?: number | null;
  captainNote?: string | null;
  message?: string | null;
  source?: string | null;
};

// Volunteer Role → the coarse public interest tags the existing matcher keys on,
// so a structured signup also produces interestTags for back-compat scoring.
const ROLE_TO_INTEREST: Array<[RegExp, string]> = [
  [/canvass|yard sign|driver|ride-to-polls/i, "Knock doors"],
  [/phone|text|relational|social media/i, "Make calls"],
  [/house party|event/i, "Host an event"],
  [/fundrais/i, "Donate"],
];

function interestTagsFromRoles(roles: string[]): string[] {
  const out = new Set<string>();
  for (const r of roles) for (const [re, tag] of ROLE_TO_INTEREST) if (re.test(r)) out.add(tag);
  return [...out];
}

// Door → the supporter-profile waysToHelp flags (drives email targeting segments).
function waysToHelpForDoor(door: JoinDoor, roles: string[]): WayToHelp[] {
  const ways = new Set<WayToHelp>();
  if (door === "Volunteer" || door === "Team Captain") ways.add("volunteer");
  if (door === "Donor Pledge") ways.add("donate");
  if (roles.some((r) => /house party|event/i.test(r))) ways.add("host");
  if (roles.some((r) => /yard sign/i.test(r))) ways.add("yardSign");
  if (roles.some((r) => /letter writer/i.test(r))) ways.add("writeLetters");
  return [...ways];
}

export type IntakeResult = { ok: boolean; message: string };

const SUCCESS: Record<JoinDoor, string> = {
  "Get Updates": "You're on the list. Watch your inbox for the latest from the campaign.",
  Volunteer: "Welcome to the team! A captain will reach out about your next action.",
  "Donor Pledge": "Thank you for pledging your support — every dollar funds the work.",
  "Team Captain": "Thank you for stepping up to lead. The campaign will follow up about captain training.",
};

export async function saveVolunteerSignup(input: VolunteerIntake): Promise<IntakeResult> {
  const name = input.name.trim();
  const email = (input.email ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const door: JoinDoor = isJoinDoor(input.door) ? input.door : "Get Updates";

  if (!name || (!email && !phone)) {
    return { ok: false, message: "Please add your name and an email or phone so we can reach you." };
  }
  if (!dbConfigured) {
    return {
      ok: false,
      message: `Our intake isn't connected yet. Please email ${CAMPAIGN.email} and we'll follow up.`,
    };
  }

  // Normalize/validate structured fields against the canonical taxonomy.
  const city = (input.city ?? "").trim() || null;
  const zip = cleanZip(input.zip) ?? null;
  const commitmentLevel = isCommitmentLevel(input.commitmentLevel) ? (input.commitmentLevel as string) : null;
  const roles = (input.roleInterests ?? []).filter(isVolunteerRole);
  const skills = (input.skills ?? []).filter(isVolunteerSkill);
  const mode = isVolunteerMode(input.mode) ? input.mode : null;
  const availability = (input.availability ?? []).filter(isAvailability);
  const message = (input.message ?? "").trim() || null;
  const captainNote = (input.captainNote ?? "").trim() || null;
  const pledgeAmount = typeof input.pledgeAmount === "number" && input.pledgeAmount > 0 ? input.pledgeAmount : null;
  const interestTags = interestTagsFromRoles(roles);
  const source = (input.source ?? "").trim() || `join-${door.toLowerCase().replace(/\s+/g, "-")}`;
  const now = new Date().toISOString();
  const signedUpDate = now.slice(0, 10);

  // Dedupe by a stable key so re-submitting updates the same lead. Latest details
  // win; status + createdAt are set once (an ACTIVE volunteer who re-submits stays).
  const dedupeKey = email ? `e:${email.toLowerCase()}` : phone ? `p:${phone.replace(/\D/g, "")}` : newId();

  let existingAirtableId: string | null = null;
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: PK.volunteers, SK: dedupeKey },
        ReturnValues: "ALL_NEW",
        UpdateExpression:
          "SET #n = :n, email = :em, phone = :ph, city = :ci, zip = :zip, #mode = :mode, skills = :sk, " +
          "availability = :av, #roles = :ro, commitment = :co, door = :door, interests = :in, interestTags = :tags, " +
          "notes = :no, captainNote = :cn, pledgeAmount = :pa, #src = :src, updatedAt = :u, " +
          "#st = if_not_exists(#st, :new), createdAt = if_not_exists(createdAt, :u)",
        ExpressionAttributeNames: {
          "#n": "name",
          "#st": "status",
          "#src": "source",
          "#mode": "mode",
          "#roles": "roles",
        },
        ExpressionAttributeValues: {
          ":n": name,
          ":em": email || null,
          ":ph": phone || null,
          ":ci": city,
          ":zip": zip,
          ":mode": mode,
          ":sk": skills,
          ":av": availability,
          ":ro": roles,
          ":co": commitmentLevel,
          ":door": door,
          ":in": interestTags.join(", ") || null,
          ":tags": interestTags,
          ":no": message,
          ":cn": captainNote,
          ":pa": pledgeAmount,
          ":src": source,
          ":u": now,
          ":new": "NEW",
        },
      }),
    );
    // Existing Airtable row id (if this email/phone signed up before) so the mirror
    // PATCHes that row instead of creating a duplicate.
    existingAirtableId = (res.Attributes?.airtableId as string) ?? null;
  } catch {
    return { ok: false, message: `Something went wrong saving your info. Please email ${CAMPAIGN.email}.` };
  }

  // ── Best-effort side effects (never fail the signup) ────────────────────────
  // SMS consent (TCPA): only on explicit opt-in + a valid US number.
  if (input.smsOptIn && phone) {
    const e164 = toE164(phone);
    if (e164) await recordConsent(e164, "join-form").catch(() => {});
  }

  // Reusable supporter profile → personalization + email targeting segments.
  if (email) {
    const ways = waysToHelpForDoor(door, roles);
    await saveProfile(email, { zip: zip ?? undefined, waysToHelp: ways }).catch(() => {});
  }

  // Mirror into the Airtable Volunteers roster (linked to Roles/Skills/Commitment).
  // Upsert: PATCH the existing row when we have one, else CREATE and persist the new
  // id back onto the DynamoDB item so a future re-submit updates the same row.
  const mirroredId = await mirrorVolunteerToAirtable(
    {
      name,
      email,
      phone,
      city,
      zip,
      door,
      commitmentLevel,
      roleInterests: roles,
      skills,
      mode,
      availability,
      smsOptIn: input.smsOptIn,
      pledgeAmount,
      captainNote,
      message,
      source,
      signedUpDate,
    },
    existingAirtableId,
  ).catch(() => null);
  if (mirroredId && mirroredId !== existingAirtableId) {
    await ddb
      .send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: PK.volunteers, SK: dedupeKey },
          UpdateExpression: "SET airtableId = :aid",
          ExpressionAttributeValues: { ":aid": mirroredId },
        }),
      )
      .catch(() => {});
  }

  await notify({ name, email, phone, city, door, message }).catch(() => {});

  // Role-targeted staff alerts (best-effort, respect per-staffer opt-outs):
  //   • Captain application → admins (only they can promote to the captain role)
  //   • New volunteer       → captains (to follow up and plug them in)
  if (door === "Team Captain") {
    await notifyAdminsCaptainApplication({ name, email, city: city ?? undefined, note: captainNote ?? undefined }).catch(() => {});
  } else if (door === "Volunteer") {
    await notifyCaptainsNewVolunteer({ name, email, interests: roles.join(", ") || undefined }).catch(() => {});
  }

  return { ok: true, message: SUCCESS[door] };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Branded receipt to the joiner + plain notification to the campaign inbox.
async function notify(p: {
  name: string;
  email: string;
  phone: string;
  city: string | null;
  door: JoinDoor;
  message: string | null;
}) {
  if (!sesEnabled) return;
  const firstName = esc(p.name.split(" ")[0] || "there");
  if (p.email) {
    const tpl =
      p.door === "Volunteer" || p.door === "Team Captain"
        ? volunteerWelcome(firstName)
        : p.door === "Get Updates"
          ? supporterWelcome(firstName)
          : contactReceipt(firstName);
    await sendEmail({ to: p.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  }
  await sendEmail({
    to: CAMPAIGN.email,
    replyTo: p.email || undefined,
    subject: `New ${p.door}: ${p.name}${p.city ? ` (${p.city})` : ""}`,
    html: `<p><strong>${esc(p.name)}</strong> — ${esc(p.door)}</p><p>Email: ${esc(p.email) || "—"}<br>Phone: ${esc(p.phone) || "—"}<br>City: ${esc(p.city ?? "") || "—"}</p>${p.message ? `<p>${esc(p.message).replace(/\n/g, "<br>")}</p>` : ""}`,
    text: `${p.name} — ${p.door}\nEmail: ${p.email}\nPhone: ${p.phone}\nCity: ${p.city ?? ""}\n\n${p.message ?? ""}`,
  });
}
