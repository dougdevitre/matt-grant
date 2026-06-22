import { CHANNELS, type ChannelId } from "@/lib/social/channels";

// Best-time auto-scheduler. Lays out N posts across upcoming days at each
// channel's optimal windows (CHANNELS.bestTimesCt, US Central — MO-02's zone).
// Pure + timezone-correct: the Central wall-clock windows are converted to real
// UTC instants via Intl, so a slot lands at the right local time year-round
// (CST/CDT), not at a naive server-UTC hour.

const CAMPAIGN_TZ = "America/Chicago";

/** Parse "8:00 AM" / "5:30 PM" → 24h {hour, minute}. */
export function parseClock(s: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.trim());
  if (!m) return { hour: 9, minute: 0 };
  let hour = Number(m[1]) % 12;
  if (/PM/i.test(m[3])) hour += 12;
  return { hour, minute: Number(m[2]) };
}

// Minutes to add to a UTC instant to get wall-clock time in `tz` (i.e. the tz
// offset at that instant: local = utc + offset). Uses Intl so DST is handled.
function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return (asUTC - date.getTime()) / 60000;
}

/** The UTC ISO string for a given Central wall-clock time on a Y/M/D date. */
export function centralToUtcISO(year: number, month0: number, day: number, hour: number, minute: number): string {
  // Start from the wall-clock interpreted as UTC, then subtract Central's offset.
  const guess = Date.UTC(year, month0, day, hour, minute);
  const offset = tzOffsetMinutes(new Date(guess), CAMPAIGN_TZ);
  return new Date(guess - offset * 60000).toISOString();
}

/** Distinct best-time clocks across the selected channels, sorted by time of day. */
export function combinedBestTimes(channels: ChannelId[]): string[] {
  const set = new Set<string>();
  for (const c of channels) for (const t of CHANNELS[c]?.bestTimesCt ?? []) set.add(t);
  if (set.size === 0) set.add("9:00 AM");
  return [...set].sort((a, b) => {
    const pa = parseClock(a);
    const pb = parseClock(b);
    return pa.hour * 60 + pa.minute - (pb.hour * 60 + pb.minute);
  });
}

/**
 * Plan up to `count` future posting slots across the selected channels' best
 * windows, starting from `fromIso`. Walks forward day by day; emits only slots
 * strictly in the future. Returns UTC ISO strings in ascending order.
 */
export function planSlots(channels: ChannelId[], count: number, fromIso: string, daysMax = 21): string[] {
  const from = new Date(fromIso);
  const now = from.getTime();
  const times = combinedBestTimes(channels).map(parseClock);
  const out: string[] = [];
  // Iterate from the campaign-local calendar day of `from`.
  const startParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: CAMPAIGN_TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(from)
      .map((x) => [x.type, x.value]),
  );
  const base = new Date(Date.UTC(Number(startParts.year), Number(startParts.month) - 1, Number(startParts.day), 12));
  for (let d = 0; d < daysMax && out.length < count; d++) {
    const day = new Date(base.getTime() + d * 86400000);
    for (const t of times) {
      if (out.length >= count) break;
      const iso = centralToUtcISO(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), t.hour, t.minute);
      if (new Date(iso).getTime() > now) out.push(iso);
    }
  }
  return out;
}
