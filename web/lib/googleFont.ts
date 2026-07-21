// Fetch a Google Font as a raw buffer for satori/next-og. Kept as a standalone module
// (imported by lib/og.tsx and lib/fonts/brandFonts.ts) so there's no import cycle.
// Non-fatal: a flaky fetch (occasionally an HTML error page) must never fail the
// build/render — returns null on any problem so the caller falls back to a local
// font or next/og's default.
export async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const cssRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!cssRes.ok) return null;
    const src = (await cssRes.text()).match(/src: url\((https:[^)]+)\) format/);
    if (!src) return null;
    const res = await fetch(src[1]);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (new Uint8Array(buf)[0] === 0x3c) return null; // '<' = HTML error page, not a font
    return buf;
  } catch {
    return null;
  }
}
