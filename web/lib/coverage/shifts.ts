// Pure poll-coverage shift logic — client-safe (no AWS SDK import), shared by the
// shift board UI and the server store. Implements candidate/poll-coverage-plan.md
// §4–§5: a shift is one site × date × window cell with a needed-count and named
// assignees; the grid, fill stats (§8 metrics), and per-person packets are all
// DERIVED from the stored shifts, never stored themselves.

export type ShiftAssignee = { id: string; name: string };

export type ShiftInput = {
  site: string;
  county?: string;
  date: string; // YYYY-MM-DD
  window: string; // staff-editable label, e.g. "Open–noon" or "6–9 AM"
  needed: number; // greeters wanted for this window (1–10)
  assignees: ShiftAssignee[];
  notes?: string;
};

export type ShiftRecord = ShiftInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string; // staff email that last touched the row
  // Assignee ids already sent a reminder text for THIS shift — storage-side
  // bookkeeping stamped by claimShiftReminder (never client-writable; not part
  // of ShiftInput/sanitizeShift). Persisted as a DynamoDB string set.
  reminded: string[];
};

// Key dates from candidate/poll-coverage-plan.md §2 (verified July 10, 2026):
// no-excuse in-person absentee runs Jul 21 – Aug 3; Election Day is Aug 4.
export const EARLY_VOTE_START = "2026-07-21";
export const ELECTION_DAY = "2026-08-04";

// Default window labels quote the plan's §4 peak windows — site open/close on
// early-vote days; before-work / midday / after-work on Election Day. Labels are
// staff-editable text, not clock claims: actual site hours come from the election
// authority (§2), never from this file.
export const DEFAULT_EARLY_WINDOWS = ["Open–noon", "Noon–close"];
export const DEFAULT_ELECTION_DAY_WINDOWS = ["6–9 AM", "9 AM–4 PM", "4–7 PM"];

const SITE_MAX = 160;
const COUNTY_MAX = 80;
const WINDOW_MAX = 40;
const NOTES_MAX = 300;
const NAME_MAX = 80;
const NEEDED_MAX = 10;
const ASSIGNEES_MAX = 10;
export const MATRIX_MAX_DAYS = 60;

const lc = (s: string) => s.trim().toLowerCase();

/** Identity for insert-time dedupe: the same site + date + window is the same
 *  shift. Used by both the client and the server action's re-check, so re-running
 *  the generator (or a double-click) can never double-insert a cell. */
export function shiftDedupeKey(s: Pick<ShiftInput, "site" | "date" | "window">): string {
  return `${lc(s.site)}|${s.date.trim()}|${lc(s.window)}`;
}

/** Incoming shifts minus anything already saved (by shiftDedupeKey). First
 *  occurrence wins within `incoming` too. */
export function filterNewShifts(
  existing: Pick<ShiftInput, "site" | "date" | "window">[],
  incoming: ShiftInput[],
): ShiftInput[] {
  const seen = new Set(existing.map(shiftDedupeKey));
  const out: ShiftInput[] = [];
  for (const row of incoming) {
    const k = shiftDedupeKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return DATE_RE.test(t) && Number.isFinite(Date.parse(`${t}T00:00:00Z`)) ? t : undefined;
};

const sanitizeAssignees = (v: unknown): ShiftAssignee[] => {
  if (!Array.isArray(v)) return [];
  const out: ShiftAssignee[] = [];
  const seen = new Set<string>();
  for (const a of v) {
    if (out.length >= ASSIGNEES_MAX) break;
    if (!a || typeof a !== "object") continue;
    const id = str((a as Record<string, unknown>).id, NAME_MAX);
    const name = str((a as Record<string, unknown>).name, NAME_MAX);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
  }
  return out;
};

/** Validate one untrusted row into a ShiftInput, or null when it isn't one.
 *  Strict where it matters: the date must be a real YYYY-MM-DD, needed clamps to
 *  1–10, assignees must be well-formed {id,name} pairs (deduped by id). */
export function sanitizeShift(raw: unknown): ShiftInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const site = str(r.site, SITE_MAX);
  const date = validDate(r.date);
  const window = str(r.window, WINDOW_MAX);
  if (!site || !date || !window) return null;
  const needed =
    typeof r.needed === "number" && Number.isFinite(r.needed)
      ? Math.min(NEEDED_MAX, Math.max(1, Math.round(r.needed)))
      : 1;
  return {
    site,
    county: str(r.county, COUNTY_MAX),
    date,
    window,
    needed,
    assignees: sanitizeAssignees(r.assignees),
    notes: str(r.notes, NOTES_MAX),
  };
}

/** Defensive mapping from a raw DynamoDB item to a record (mirrors the signs
 *  store): the payload is re-sanitized so a hand-edited item can't smuggle
 *  malformed assignees or dates into the board. */
export function rawToShift(it: Record<string, unknown>): ShiftRecord | null {
  const input = sanitizeShift(it);
  if (!input) return null;
  const id = typeof it.SK === "string" && it.SK ? it.SK : typeof it.id === "string" ? it.id : "";
  if (!id) return null;
  // The doc client returns a DynamoDB string set as a JS Set; tolerate arrays too.
  const rawReminded = it.reminded;
  const reminded = (rawReminded instanceof Set ? [...rawReminded] : Array.isArray(rawReminded) ? rawReminded : [])
    .filter((v): v is string => typeof v === "string" && !!v);
  return {
    ...input,
    id,
    createdAt: typeof it.createdAt === "string" ? it.createdAt : "",
    updatedAt: typeof it.updatedAt === "string" ? it.updatedAt : "",
    updatedBy: typeof it.updatedBy === "string" ? it.updatedBy : "",
    reminded,
  };
}

/** Inclusive YYYY-MM-DD range, capped at MATRIX_MAX_DAYS. Empty on bad input. */
export function datesInRange(start: string, end: string): string[] {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return [];
  const out: string[] = [];
  for (let t = s; t <= e && out.length < MATRIX_MAX_DAYS; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export type MatrixSite = { site: string; county?: string };

/** The schedule generator: every site × date gets the early-vote windows, except
 *  Election Day (Aug 4), which gets the Election-Day peak windows. needed=1,
 *  no assignees — coverage starts honestly uncovered (§4 serviceability rule). */
export function buildShiftMatrix(
  sites: MatrixSite[],
  dates: string[],
  earlyWindows: string[] = DEFAULT_EARLY_WINDOWS,
  electionDayWindows: string[] = DEFAULT_ELECTION_DAY_WINDOWS,
): ShiftInput[] {
  const out: ShiftInput[] = [];
  for (const { site, county } of sites) {
    for (const date of dates) {
      const windows = date === ELECTION_DAY ? electionDayWindows : earlyWindows;
      for (const window of windows) {
        out.push({ site, county, date, window, needed: 1, assignees: [] });
      }
    }
  }
  return out;
}

export type ShiftStatus = "covered" | "partial" | "uncovered";

export function shiftStatus(s: Pick<ShiftInput, "needed" | "assignees">): ShiftStatus {
  if (s.assignees.length >= s.needed) return "covered";
  return s.assignees.length > 0 ? "partial" : "uncovered";
}

/** Deterministic within-day ordering for window labels: "Open…" first, then by
 *  starting hour parsed from the label (first meridiem in the label disambiguates
 *  AM/PM), "Noon…" at 12, unlabeled/unparseable last (alphabetical tiebreak). */
export function windowRank(label: string): number {
  const l = lc(label);
  if (l.startsWith("open")) return -1;
  if (l.startsWith("noon")) return 12;
  const m = l.match(/^(\d{1,2})/);
  if (!m) return 24;
  let h = Number(m[1]) % 12;
  const meridiem = l.match(/\b(am|pm)\b/);
  if (meridiem?.[1] === "pm") h += 12;
  return h;
}

const byWindow = (a: ShiftRecord, b: ShiftRecord) =>
  windowRank(a.window) - windowRank(b.window) || a.window.localeCompare(b.window);

export type GridDay = { date: string; shifts: ShiftRecord[]; fullyCovered: boolean };
export type GridSite = { site: string; county?: string; days: GridDay[] };

/** Group shifts site → date → window (all sorted) for the board. */
export function coverageGrid(shifts: ShiftRecord[]): GridSite[] {
  const bySite = new Map<string, ShiftRecord[]>();
  for (const s of shifts) {
    const key = lc(s.site);
    const list = bySite.get(key) ?? [];
    list.push(s);
    bySite.set(key, list);
  }
  const sites: GridSite[] = [];
  for (const list of bySite.values()) {
    const byDate = new Map<string, ShiftRecord[]>();
    for (const s of list) {
      const day = byDate.get(s.date) ?? [];
      day.push(s);
      byDate.set(s.date, day);
    }
    const days: GridDay[] = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayShifts]) => ({
        date,
        shifts: dayShifts.sort(byWindow),
        fullyCovered: dayShifts.every((s) => shiftStatus(s) === "covered"),
      }));
    sites.push({ site: list[0].site, county: list.find((s) => s.county)?.county, days });
  }
  return sites.sort((a, b) => a.site.localeCompare(b.site));
}

export type FillStats = {
  total: number;
  covered: number;
  partial: number;
  uncovered: number;
  fillPct: number; // % of shifts fully covered
  days: Array<{ date: string; sites: number; sitesFullyCovered: number }>;
};

/** The plan's §8 metrics: fill rate overall + per-day fully-covered site counts. */
export function fillStats(shifts: ShiftRecord[]): FillStats {
  let covered = 0;
  let partial = 0;
  const byDay = new Map<string, Map<string, boolean>>(); // date → site → fully covered
  for (const s of shifts) {
    const st = shiftStatus(s);
    if (st === "covered") covered += 1;
    else if (st === "partial") partial += 1;
    const day = byDay.get(s.date) ?? new Map<string, boolean>();
    const key = lc(s.site);
    day.set(key, (day.get(key) ?? true) && st === "covered");
    byDay.set(s.date, day);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sites]) => ({
      date,
      sites: sites.size,
      sitesFullyCovered: [...sites.values()].filter(Boolean).length,
    }));
  const total = shifts.length;
  return {
    total,
    covered,
    partial,
    uncovered: total - covered - partial,
    fillPct: total ? Math.round((100 * covered) / total) : 0,
    days,
  };
}

// ---------------------------------------------------------------------------
// Reminder texts — pure planning for the "Remind greeters by text" action. The
// action itself sends via sendLifecycleText (which owns consent/blocks/quiet
// hours); these helpers only decide WHO gets ONE message and WHAT it says.

export type ReminderTarget = { assignee: ShiftAssignee; shifts: ShiftRecord[] };

/**
 * Who still needs a reminder for `date`: every assignee on that day's shifts
 * who isn't already in the shift's `reminded` set, one target per person
 * covering ALL their shifts that day (one text each). Split by id shape: an id
 * containing "@" is a staff email (captain) — those resolve to a phone via the
 * staffer's own "My text alerts" number (Clerk), volunteers via the roster.
 */
export function remindersFor(shifts: ShiftRecord[], date: string): { volunteers: ReminderTarget[]; captains: ReminderTarget[] } {
  const vols = new Map<string, ReminderTarget>();
  const caps = new Map<string, ReminderTarget>();
  const day = shifts.filter((s) => s.date === date.trim());
  for (const s of day.sort(byWindow)) {
    for (const a of s.assignees) {
      if (s.reminded.includes(a.id)) continue;
      const bucket = a.id.includes("@") ? caps : vols;
      const t = bucket.get(a.id) ?? { assignee: a, shifts: [] };
      t.shifts.push(s);
      bucket.set(a.id, t);
    }
  }
  const byName = (a: ReminderTarget, b: ReminderTarget) => a.assignee.name.localeCompare(b.assignee.name);
  return { volunteers: [...vols.values()].sort(byName), captains: [...caps.values()].sort(byName) };
}

// Keep reminder texts in the cheap GSM-7 alphabet: window labels and site names
// may carry en/em dashes or curly quotes, any one of which flips the whole
// message to UCS-2 and doubles the segment cost.
const gsm = (s: string) => s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, "-");

const fmtReminderDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * One reminder message covering a person's shifts on a date. No compliance
 * suffix here — sendLifecycleText appends the shared paid-for/STOP line. The
 * conduct sentence restates the already-verified plan §7 rule, nothing new.
 */
export function reminderBody(firstName: string, shifts: Pick<ShiftRecord, "site" | "window">[], date: string): string {
  const stops = shifts.map((s) => `${s.site} (${s.window})`).join(", then ");
  return gsm(
    `Hi ${firstName || "there"}, Matt Grant campaign reminder: you're greeting ${fmtReminderDay(date)} at ${stops}. ` +
      `Stay 25+ ft from the polling-place door; friendly reminder, then space. Questions? Reply here.`,
  );
}

export type ShiftPacket = { assigneeId: string; name: string; shifts: ShiftRecord[] };

/** Per-person shift packets for printing (a shift with several assignees appears
 *  in each person's packet), plus the honest "unfilled" bucket — every shift still
 *  short of its needed count. */
export function shiftPackets(shifts: ShiftRecord[]): { packets: ShiftPacket[]; unfilled: ShiftRecord[] } {
  const byPerson = new Map<string, ShiftPacket>();
  const chrono = (a: ShiftRecord, b: ShiftRecord) =>
    a.date.localeCompare(b.date) || byWindow(a, b) || a.site.localeCompare(b.site);
  for (const s of shifts) {
    for (const a of s.assignees) {
      const p = byPerson.get(a.id) ?? { assigneeId: a.id, name: a.name, shifts: [] };
      p.shifts.push(s);
      byPerson.set(a.id, p);
    }
  }
  const packets = [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of packets) p.shifts.sort(chrono);
  const unfilled = shifts.filter((s) => shiftStatus(s) !== "covered").sort(chrono);
  return { packets, unfilled };
}
