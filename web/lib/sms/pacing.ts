// SMS drain throughput + ETA — PURE + testable. The queue drains in bounded
// batches (BATCH per drain × BATCHES_PER_RUN per cron invocation, at rate(1 minute)),
// so a large blast paces out over the 9am–8pm CT quiet-hours window. This module
// owns the two knobs (env-configurable, bounded) and a window-aware completion
// estimate the composer + recent-sends list show so operators know how long a big
// send takes. No data store, no send, no voter data — safe anywhere.

const clampInt = (raw: string | undefined, def: number, lo: number, hi: number): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
};

// Texts per drain call. Small by default to respect Twilio toll-free throughput
// (~3 msg/s); bounded 1..60 so a typo can't blow past carrier limits.
export const SMS_DRAIN_BATCH = clampInt(process.env.SMS_DRAIN_BATCH, 10, 1, 60);
// Batches per cron invocation (the cron fires every minute). Bounded 1..20.
export const SMS_DRAIN_BATCHES_PER_RUN = clampInt(process.env.SMS_DRAIN_BATCHES_PER_RUN, 3, 1, 20);
// Steady-state texts per minute once inside the send window.
export const SMS_DRAIN_PER_MINUTE = SMS_DRAIN_BATCH * SMS_DRAIN_BATCHES_PER_RUN;

const SEND_START_HOUR = 9; // 9am CT — mirrors withinSendWindow() in campaigns.ts
const SEND_END_HOUR = 20; // 8pm CT

/** CT hour + minute for a moment, via Intl (DST-correct). */
function ctHourMinute(d: Date): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  // "24" at midnight in some engines → normalize to 0.
  const h = get("hour") % 24;
  return { h, m: get("minute") };
}

export type DrainEstimate = {
  perMinute: number; // effective throughput
  sendMinutes: number; // minutes of actual sending needed
  eta: Date; // wall-clock completion, accounting for quiet hours
  spansWindows: boolean; // true when the send can't finish in the current window
};

/**
 * Estimate when a queued blast finishes, given how many recipients remain. Sending
 * only happens 9am–8pm CT, so the estimate consumes in-window minutes and skips the
 * overnight gap. Pure: pass `now` for deterministic tests. Steps hour-by-hour, so it
 * stays cheap even for multi-day sends.
 */
export function estimateDrainCompletion(
  remaining: number,
  now: Date = new Date(),
  perMinute: number = SMS_DRAIN_PER_MINUTE,
): DrainEstimate {
  const rate = Math.max(1, Math.floor(perMinute));
  const rem = Math.max(0, Math.floor(remaining));
  if (rem === 0) return { perMinute: rate, sendMinutes: 0, eta: new Date(now), spansWindows: false };

  let sendMinutes = Math.ceil(rem / rate);
  const total = sendMinutes;
  let cursor = now.getTime();
  let spans = false;
  // Guard against an infinite loop; a realistic blast finishes in far fewer steps.
  for (let guard = 0; sendMinutes > 0 && guard < 10000; guard++) {
    const { h, m } = ctHourMinute(new Date(cursor));
    const minsToNextHour = 60 - m;
    if (h >= SEND_START_HOUR && h < SEND_END_HOUR) {
      const consume = Math.min(sendMinutes, minsToNextHour);
      sendMinutes -= consume;
      cursor += consume * 60000;
    } else {
      // Outside the window — jump to the next hour boundary without sending.
      spans = true;
      cursor += minsToNextHour * 60000;
    }
  }
  // If we started mid-send but the first slot didn't cover it, we crossed a window.
  if (!spans && total > 0) {
    const startH = ctHourMinute(now).h;
    const endH = ctHourMinute(new Date(cursor)).h;
    spans = startH !== endH && (endH < startH || total > SEND_END_HOUR * 60);
  }
  return { perMinute: rate, sendMinutes: total, eta: new Date(cursor), spansWindows: spans };
}

/** Human ETA in CT, e.g. "Thu 2:10 PM CT" (or "today 2:10 PM CT" when same day). */
export function formatEtaCT(eta: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(eta) + " CT"
  );
}
