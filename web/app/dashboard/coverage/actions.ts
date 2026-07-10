"use server";

import { revalidatePath } from "next/cache";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import {
  buildShiftMatrix,
  datesInRange,
  DEFAULT_EARLY_WINDOWS,
  DEFAULT_ELECTION_DAY_WINDOWS,
  filterNewShifts,
  reminderBody,
  remindersFor,
  sanitizeShift,
  type MatrixSite,
  type ShiftAssignee,
} from "@/lib/coverage/shifts";
import {
  claimShiftReminder,
  createShifts,
  deleteShift,
  getShift,
  listShifts,
  unclaimShiftReminder,
  updateShift,
} from "@/lib/coverage/shiftStore";
import { getVolunteer } from "@/lib/queries";
import { listStaffContacts } from "@/lib/clerkAudiences";
import { sendLifecycleText } from "@/lib/sms/lifecycle";

// Server actions for the poll-coverage shift board. Gated on manageTeam — the
// same capability as the coverage page this board lives beside; every write
// re-checks it server-side regardless of what the UI rendered. Modeled on
// app/dashboard/signs/actions.ts.

const MAX_GENERATE_CELLS = 2000;
const MAX_SITES = 100;
const MAX_WINDOWS = 6;

async function gate(): Promise<{ email: string } | null> {
  const g = await staffGate();
  if (!g.ok || !can(g.role, "manageTeam")) return null;
  return { email: g.email ?? "" };
}

function refresh() {
  revalidatePath("/dashboard/coverage/shifts");
}

export type ShiftsGenerateState = { ok: boolean; message: string };

const parseWindows = (raw: unknown, fallback: string[]): string[] => {
  const labels = String(raw ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, MAX_WINDOWS);
  return labels.length ? labels : fallback;
};

/** Generate the site × day × window schedule. Insert-new-only (shiftDedupeKey),
 *  so re-running with an extended site list or date range only adds the new cells. */
export async function generateShiftsAction(_prev: ShiftsGenerateState, formData: FormData): Promise<ShiftsGenerateState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };

  // One site per line, optional ", County" suffix.
  const sites: MatrixSite[] = String(formData.get("sites") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_SITES)
    .map((line) => {
      const [site, county] = line.split(",").map((p) => p.trim());
      return { site, county: county || undefined };
    })
    .filter((s) => s.site);
  if (sites.length === 0) return { ok: false, message: "Add at least one site (one per line)." };

  const dates = datesInRange(String(formData.get("start") ?? ""), String(formData.get("end") ?? ""));
  if (dates.length === 0) return { ok: false, message: "Pick a valid date range (start before end)." };

  const earlyWindows = parseWindows(formData.get("earlyWindows"), DEFAULT_EARLY_WINDOWS);
  const edWindows = parseWindows(formData.get("electionDayWindows"), DEFAULT_ELECTION_DAY_WINDOWS);

  const matrix = buildShiftMatrix(sites, dates, earlyWindows, edWindows)
    .map(sanitizeShift)
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (matrix.length === 0) return { ok: false, message: "Nothing to generate." };
  if (matrix.length > MAX_GENERATE_CELLS) {
    return { ok: false, message: `That's ${matrix.length} shifts — trim the sites, dates, or windows (max ${MAX_GENERATE_CELLS}).` };
  }

  try {
    // Re-dedupe against what's saved NOW — re-running the generator is a no-op
    // for existing cells (double-click, extended range, stale tab).
    const existing = await listShifts();
    const fresh = filterNewShifts(existing, matrix);
    const created = await createShifts(fresh, g.email);
    refresh();
    const skipped = matrix.length - fresh.length;
    return {
      ok: true,
      message: `Created ${created} shift${created === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped} already on the board` : ""}.`,
    };
  } catch {
    return { ok: false, message: "Couldn't generate. Check the database connection." };
  }
}

/** Add or remove one assignee on a shift (read-modify-write against current state).
 *  The add path reads a single `assignee` field of the form `id::name` — one
 *  <select> option carries both halves (a native select submits one value). */
export async function assignShift(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  const op = String(formData.get("op") ?? "");
  if (!id || (op !== "add" && op !== "remove")) return;

  const shift = await getShift(id);
  if (!shift) return;
  let assignees: ShiftAssignee[];
  if (op === "remove") {
    const assigneeId = String(formData.get("assigneeId") ?? "").trim().slice(0, 80);
    if (!assigneeId) return;
    assignees = shift.assignees.filter((a) => a.id !== assigneeId);
  } else {
    const combined = String(formData.get("assignee") ?? "");
    const sep = combined.indexOf("::");
    const assigneeId = (sep > 0 ? combined.slice(0, sep) : "").trim().slice(0, 80);
    const name = (sep > 0 ? combined.slice(sep + 2) : "").trim().slice(0, 80);
    if (!assigneeId || !name || shift.assignees.some((a) => a.id === assigneeId)) return;
    if (shift.assignees.length >= 10) return;
    assignees = [...shift.assignees, { id: assigneeId, name }];
  }
  // [] must SET (not REMOVE) so an emptied roster round-trips as uncovered.
  await updateShift(id, { assignees }, g.email);
  refresh();
}

/** Change how many greeters a shift needs (1–10). */
export async function setShiftNeeded(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  const needed = Number(formData.get("needed"));
  if (!id || !Number.isFinite(needed)) return;
  await updateShift(id, { needed: Math.min(10, Math.max(1, Math.round(needed))) }, g.email);
  refresh();
}

/** Update the operational notes on a shift (site quirks, posted buffer line, parking). */
export async function setShiftNotes(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 300);
  await updateShift(id, { notes: notes || undefined }, g.email);
  refresh();
}

export type ShiftRemindersState = { ok: boolean; message: string };

/**
 * Text every assigned greeter their shift(s) for one date — one message per
 * person covering all their windows that day. ALL send policy lives in
 * sendLifecycleText (configured + opted-in + not-blocked + quiet hours 9am–8pm
 * CT via respectQuietHours — reminders are staff-initiated, so outside the
 * window they're skipped, not queued). This action only plans recipients,
 * claims per-shift-per-assignee dedupe (re-runs text only newly added people),
 * and reports honest counts. Volunteers resolve to a phone via the roster;
 * captains (staff-email assignees) via the number from their OWN "My text
 * alerts" opt-in (Clerk publicMetadata — never entered by an admin); a captain
 * without one is reported as skipped, never guessed.
 */
export async function sendShiftRemindersAction(_prev: ShiftRemindersState, formData: FormData): Promise<ShiftRemindersState> {
  const g = await gate();
  if (!g) return { ok: false, message: "Not allowed." };
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Pick a date to remind." };

  try {
    const shifts = await listShifts();
    const { volunteers, captains } = remindersFor(shifts, date);
    if (!volunteers.length && !captains.length) {
      return { ok: false, message: "No unreminded assignees on that date — assign greeters first (or they've all been texted)." };
    }

    // Captain emails → their self-set text-alerts number (one Clerk pass; [] when
    // Clerk is off, which lands every captain in the honest "no number" count).
    const staffPhones = new Map<string, string>();
    if (captains.length) {
      for (const c of await listStaffContacts()) {
        if (c.email && c.phone) staffPhones.set(c.email.toLowerCase(), c.phone);
      }
    }

    let sent = 0;
    let alreadyClaimed = 0;
    const skipReasons = new Map<string, number>();
    const skip = (reason: string) => skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1);

    // One shared path for both buckets: claim → resolve phone → send → roll
    // back the claims on any not-sent outcome, so a quiet-hours click at 8:30am
    // (or a missing number) never permanently marks someone "reminded".
    const remind = async (t: { assignee: { id: string; name: string }; shifts: { id: string; site: string; window: string }[] }, phone: string | null, noPhoneReason: string) => {
      const claimed: typeof t.shifts = [];
      for (const s of t.shifts) {
        if (await claimShiftReminder(s.id, t.assignee.id)) claimed.push(s);
      }
      if (!claimed.length) {
        alreadyClaimed += 1;
        return;
      }
      const rollback = async () => {
        for (const s of claimed) await unclaimShiftReminder(s.id, t.assignee.id);
      };
      if (!phone) {
        skip(noPhoneReason);
        await rollback();
        return;
      }
      const first = t.assignee.name.trim().split(/\s+/)[0];
      const r = await sendLifecycleText({
        to: phone,
        body: reminderBody(first, claimed, date),
        by: g.email || "system",
        respectQuietHours: true,
      }).catch(() => ({ sent: false as const, reason: "send failed" }));
      if (r.sent) sent += 1;
      else {
        skip(r.reason ?? "not sent");
        await rollback();
      }
    };

    for (const t of volunteers) {
      const vol = await getVolunteer(t.assignee.id).catch(() => null);
      await remind(
        { assignee: { id: t.assignee.id, name: vol?.name || t.assignee.name }, shifts: t.shifts },
        vol?.phone ?? null,
        "no phone on file",
      );
    }
    for (const t of captains) {
      await remind(t, staffPhones.get(t.assignee.id.toLowerCase()) ?? null, "no text-alerts number (opt in under My notifications)");
    }

    refresh();
    const parts = [`Texted ${sent} greeter${sent === 1 ? "" : "s"}`];
    if (alreadyClaimed) parts.push(`${alreadyClaimed} already reminded`);
    for (const [reason, n] of skipReasons) parts.push(`${n} skipped (${reason})`);
    return { ok: true, message: `${parts.join(" · ")}.` };
  } catch {
    return { ok: false, message: "Couldn't send reminders. Check the database connection." };
  }
}

/** Remove a shift generated in error (hard delete). */
export async function removeShift(formData: FormData): Promise<void> {
  const g = await gate();
  if (!g) return;
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await deleteShift(id);
  refresh();
}
