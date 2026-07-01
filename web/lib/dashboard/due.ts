// Pure due-date logic for tasks. Dates are date-only strings (YYYY-MM-DD) compared
// against a passed-in `today` (also YYYY-MM-DD), so it's deterministic and testable
// with no Date.now/TZ surprises. Classifies a task's due date into the buckets the
// board badges and the personal "your task for the day" surfacing need.

export const DUE_SOON_DAYS = 7;

export type DueState = "none" | "overdue" | "today" | "soon" | "later";
export type Due = { state: DueState; label: string };

// Normalize (untrusted) input to a YYYY-MM-DD date, or undefined. Accepts the
// leading date of an ISO string too (e.g. from a datetime value).
export function cleanDate(s?: string | null): string | undefined {
  const m = (s ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const ms = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const dayDiff = (a: string, b: string) => Math.round((ms(a) - ms(b)) / 86_400_000);
const fmt = (ymd: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/** Bucket + human label for a task's due date relative to `today` (YYYY-MM-DD). */
export function classifyDue(dueDate: string | null | undefined, today: string): Due {
  const d = cleanDate(dueDate);
  if (!d) return { state: "none", label: "" };
  const diff = dayDiff(d, today);
  if (diff < 0) return { state: "overdue", label: diff === -1 ? "1 day overdue" : `${-diff} days overdue` };
  if (diff === 0) return { state: "today", label: "due today" };
  if (diff <= DUE_SOON_DAYS) return { state: "soon", label: diff === 1 ? "due tomorrow" : `due ${fmt(d, { weekday: "long" })}` };
  return { state: "later", label: `due ${fmt(d, { month: "short", day: "numeric" })}` };
}

// Sort key so undated tasks sink and the soonest due (incl. overdue) rise. Pure.
export function dueSortKey(dueDate: string | null | undefined): number {
  const d = cleanDate(dueDate);
  return d ? ms(d) : Number.POSITIVE_INFINITY;
}
