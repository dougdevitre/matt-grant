// Pure trend math for the dashboard KPI tiles — no React, no I/O, no Date.now(), so
// it's fully unit-testable and safe anywhere. `today` is always injected by the
// caller (the query layer stamps it at request time). Timestamps are ISO strings;
// bucketing is by UTC calendar day so a fixed `today` gives deterministic results.

/** Sum event values into the trailing `days` daily buckets (oldest → newest). Events
 *  outside [today-(days-1), today] are dropped; negative values (refunds) net out. */
export function bucketByDay(
  events: { at: string; value: number }[],
  opts: { days: number; today: string },
): number[] {
  const { days, today } = opts;
  const buckets = new Array(days).fill(0);
  const end = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(end) || days <= 0) return buckets;
  const DAY = 86_400_000;
  for (const e of events) {
    const t = Date.parse(e.at);
    if (Number.isNaN(t)) continue;
    // Whole UTC days between the event day and today (0 = today, 1 = yesterday…).
    const eventDay = Math.floor(t / DAY) * DAY;
    const ago = Math.round((end - eventDay) / DAY);
    if (ago < 0 || ago >= days) continue; // future or older than the window
    buckets[days - 1 - ago] += e.value;
  }
  return buckets;
}

/** Split a series into the last `w` buckets (recent) vs the `w` before that (prior). */
export function windowSums(series: number[], w: number): { recent: number; prior: number } {
  const n = series.length;
  const clamp = (i: number) => Math.max(0, Math.min(n, i)); // guard negative slice ends
  const sum = (a: number, b: number) => series.slice(clamp(a), clamp(b)).reduce((s, v) => s + v, 0);
  return { recent: sum(n - w, n), prior: sum(n - 2 * w, n - w) };
}

export type DeltaChip = { label: string; dir: "up" | "down" | "flat"; tone: "good" | "bad" | "neutral" };

/**
 * Build a tile delta chip from a recent-vs-prior pair. `label` is caller-formatted
 * (e.g. "$1,200 · 7d" or "+8 · 7d"). Direction is by sign of (recent - prior); tone
 * maps direction to good/bad via `goodWhenUp` (spending up would be bad, etc.). A
 * zero change is "flat"/neutral.
 */
export function deltaChip(recent: number, prior: number, opts: { label: string; goodWhenUp: boolean }): DeltaChip {
  const diff = recent - prior;
  const dir: DeltaChip["dir"] = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const tone: DeltaChip["tone"] =
    dir === "flat" ? "neutral" : (dir === "up") === opts.goodWhenUp ? "good" : "bad";
  return { label: opts.label, dir, tone };
}
