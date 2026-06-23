// Input sanitization for user-supplied URLs in the Social Command Center. A post's
// link and media URL flow into stored records, the calendar UI, and outbound social
// API calls, so reject anything that isn't a plain http(s) URL before it's stored —
// closing off javascript:/data: schemes and "//host" protocol-relative values that
// would otherwise become a live XSS vector when rendered in an href.

/** An absolute http(s) URL, normalized — or undefined if the input isn't one. */
export function sanitizeHttpUrl(raw: string | null | undefined): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return undefined; // not absolute / not parseable (also rejects "//host" and "/path")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  return url.toString();
}

/**
 * A post's media URL. The attach-graphic flow stores a site-relative path
 * (/api/graphics?…) that publish.ts later resolves against SITE_URL, so allow a
 * single-slash-rooted path in addition to absolute http(s) — but still reject
 * "//host" protocol-relative URLs and javascript:/data: schemes.
 */
export function sanitizeMediaUrl(raw: string | null | undefined): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  if (v.startsWith("/") && !v.startsWith("//")) return v; // site-relative app path
  return sanitizeHttpUrl(v);
}
