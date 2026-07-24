// Opt-in growth analytics — PURE + testable. Reduces the SMS consent ledger into
// "where opt-ins come from" (by source) + "how the list is growing" (by day), so the
// campaign can invest in the channels that actually convert. Reads only the consent
// rows the caller already loaded (listConsent) — no data store, no send, no voter
// data — so it's safe anywhere and lives in lib/reports/ beside the other reports.
import type { SmsConsentRow } from "@/lib/sms/consent";

// Friendly labels for the raw `source` tags recordConsent() stamps. Unknown sources
// fall back to the raw string so nothing is silently dropped.
export const SOURCE_LABELS: Record<string, string> = {
  "sms-keyword": "Text keyword",
  "sms-start": "Re-subscribe (START)",
  "sms-cta-donate": "Text DONATE",
  "sms-cta-volunteer": "Text VOLUNTEER",
  "sms-cta-events": "Text EVENTS",
  "sms-cta-vote": "Text VOTE",
  winred: "WinRed donors",
  "web-form": "Contact form",
  "issue-topic": "Issue form",
  "event-rsvp": "Event RSVP",
  "join-form": "Join page",
  "games-lead": "Game opt-in",
  "staff-optin": "Staff",
  "csv-import": "CSV import",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export type OptinBySource = { source: string; label: string; count: number; pct: number };
export type OptinByDay = { date: string; optIns: number };
export type OptinGrowth = {
  totals: { optedIn: number; optedOut: number; sources: number };
  bySource: OptinBySource[]; // opted-in only, ranked desc (ties broken by label for stability)
  byDay: OptinByDay[]; // one entry per day across the window, oldest→newest (zero-filled)
  recentOptIns: number; // opt-ins whose consentAt falls in the window
  windowDays: number;
};

const UNKNOWN_SOURCE = "unknown";

/** UTC calendar day (YYYY-MM-DD) for a timestamp, or null if unparseable. */
function dayKey(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Aggregate the consent ledger. `now`/`days` are injectable for deterministic tests
 * (default: today, 30-day window). Opt-in counts use each row's `consentAt`; the
 * window is the last `days` calendar days ending today (UTC).
 */
export function optinGrowth(rows: SmsConsentRow[], opts: { now?: number; days?: number } = {}): OptinGrowth {
  const windowDays = Math.max(1, Math.floor(opts.days ?? 30));
  const now = opts.now ?? Date.now();

  let optedIn = 0;
  let optedOut = 0;
  const perSource = new Map<string, number>();
  const perDay = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "opted_out") {
      optedOut++;
      continue;
    }
    if (r.status !== "opted_in") continue;
    optedIn++;
    const src = (r.source ?? "").trim() || UNKNOWN_SOURCE;
    perSource.set(src, (perSource.get(src) ?? 0) + 1);
    const day = dayKey(r.consentAt);
    if (day) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const bySource: OptinBySource[] = [...perSource.entries()]
    .map(([source, count]) => ({ source, label: sourceLabel(source), count, pct: optedIn > 0 ? (count / optedIn) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // Zero-filled window, oldest→newest, ending today (UTC).
  const byDay: OptinByDay[] = [];
  let recentOptIns = 0;
  const startOfToday = new Date(new Date(now).toISOString().slice(0, 10)).getTime();
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = new Date(startOfToday - i * 86_400_000).toISOString().slice(0, 10);
    const optIns = perDay.get(date) ?? 0;
    recentOptIns += optIns;
    byDay.push({ date, optIns });
  }

  return {
    totals: { optedIn, optedOut, sources: perSource.size },
    bySource,
    byDay,
    recentOptIns,
    windowDays,
  };
}
