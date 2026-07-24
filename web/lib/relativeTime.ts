// Coarse relative time — "just now" / "3h ago" / "2d ago", or a short date past a
// week; "never" for a null/invalid timestamp. Pure and `now`-injectable so it's
// unit-testable AND safe to call on the server (format once, pass the string to
// client components — no client-side Date.now() hydration mismatch).

export type RelTimeOpts = { now?: number };

export function relTime(iso: string | null | undefined, opts: RelTimeOpts = {}): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never";
  const now = opts.now ?? Date.now();
  const mins = Math.max(0, Math.floor((now - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** True when the timestamp is null/invalid or older than `maxAgeHours` (default 48) —
 *  used to nudge an operator that voter scores may be stale. "never" counts as stale. */
export function isStale(iso: string | null | undefined, maxAgeHours = 48, opts: RelTimeOpts = {}): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return true;
  const now = opts.now ?? Date.now();
  return now - then > maxAgeHours * 3600_000;
}
