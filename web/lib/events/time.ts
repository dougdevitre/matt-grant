// Central-time helpers for event datetimes. The dashboard form uses
// <input type="datetime-local"> which yields a zone-less "YYYY-MM-DDThh:mm"; the
// campaign operates in America/Chicago, so we interpret/emit those strings as
// Central (DST-aware via Intl) while storing canonical ISO 8601 (UTC) on the item.
// Pure + isomorphic (server + client).

// Central wall-clock "2026-07-12T18:00" → ISO UTC, accounting for CST/CDT on that day.
export function localCentralToIso(local: string): string {
  const m = String(local).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as [string, number, number, number, number, number];
  const approx = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const tz =
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" })
      .formatToParts(approx)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  const off = tz.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  const offH = off ? Number(off[1]) : -6;
  const offM = off && off[2] ? Number(off[2]) : 0;
  const ms = Date.UTC(y, mo - 1, d, h, mi) - (offH * 60 + Math.sign(offH || -1) * offM) * 60_000;
  return new Date(ms).toISOString();
}

// ISO → Central wall-clock "2026-07-12T18:00" for prefilling a datetime-local input.
export function isoToCentralLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

// Friendly display range, e.g. "Sat, Jul 12, 2026 · 6:00 – 8:00 PM CT".
export function formatEventRange(startIso: string, endIso?: string | null): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", year: "numeric",
  }).format(start);
  const t = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(d);
  const end = endIso ? new Date(endIso) : null;
  const times = end && !Number.isNaN(end.getTime()) ? `${t(start)} – ${t(end)}` : t(start);
  return `${date} · ${times} CT`;
}
