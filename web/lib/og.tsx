import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared renderer for branded 1200×630 social cards (Open Graph + Twitter).
// Red/white/blue palette to match the current brand; dynamic so every page can
// get its own card and copy stays in code.
const INK = "#0F2540";
const PAPER = "#FBFAF6";
const BRICK = "#B5343B";
const BLUE = "#6BA6FF";
const MUTED = "#9FB0C3";

// Non-fatal: a flaky Google Fonts fetch (occasionally an HTML error page) must
// never fail the build/render. Returns null on any problem → render falls back
// to next/og's default font.
async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
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

export type OgCard = { eyebrow: string; line1: string; line2: string; name: string; footer: string };

export async function renderOgCard(card: OgCard): Promise<ImageResponse> {
  const headlineText = card.line1 + card.line2;
  const bodyText = card.eyebrow + card.name + card.footer + "·";
  const [fraunces, publicSans, avatar] = await Promise.all([
    googleFont("Fraunces", 700, headlineText),
    googleFont("Public Sans", 600, bodyText),
    readFile(join(process.cwd(), "public/brand/avatar-circle.png")),
  ]);
  const avatarSrc = `data:image/png;base64,${avatar.toString("base64")}`;
  const fonts = [
    fraunces && { name: "Fraunces", data: fraunces, weight: 700 as const, style: "normal" as const },
    publicSans && { name: "Public Sans", data: publicSans, weight: 600 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 600; style: "normal" }[];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", backgroundColor: INK, fontFamily: "Public Sans" }}>
        {/* tri-color top rule */}
        <div style={{ display: "flex", height: 12 }}>
          <div style={{ flex: 1, backgroundColor: BRICK }} />
          <div style={{ flex: 1, backgroundColor: PAPER }} />
          <div style={{ flex: 1, backgroundColor: BLUE }} />
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 72px" }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
            <div style={{ display: "flex", color: BLUE, fontSize: 24, fontWeight: 600, letterSpacing: 6 }}>{card.eyebrow}</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 20, fontFamily: "Fraunces", fontWeight: 700, fontSize: 78, lineHeight: 1.04 }}>
              <div style={{ display: "flex", color: PAPER }}>{card.line1}</div>
              <div style={{ display: "flex", color: BRICK }}>{card.line2}</div>
            </div>
            <div style={{ display: "flex", color: PAPER, fontSize: 32, fontWeight: 600, marginTop: 32 }}>{card.name}</div>
            <div style={{ display: "flex", color: MUTED, fontSize: 23, marginTop: 14 }}>{card.footer}</div>
          </div>
          <div style={{ display: "flex", width: 360, height: 360, borderRadius: 360, border: `6px solid ${BLUE}`, overflow: "hidden", flexShrink: 0 }}>
            <img src={avatarSrc} width={360} height={360} style={{ objectFit: "cover" }} alt="" />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}

// Split a title into a roughly balanced two-line headline — the fallback when a
// pillar has no explicit `ogHeadline`. Best-effort; word boundaries only.
function splitHeadline(title: string): { line1: string; line2: string } {
  const words = title.replace(/&amp;/g, "&").split(/\s+/);
  if (words.length < 2) return { line1: title, line2: "" };
  const mid = Math.ceil(words.length / 2);
  return { line1: words.slice(0, mid).join(" "), line2: words.slice(mid).join(" ") };
}

// Per-pillar social card. Reuses renderOgCard so the brand (fonts, avatar,
// tri-color rule) is identical to the apex card; only the eyebrow + headline
// change. Resource framing only — never a policy claim (see lib/pillars.ts).
export async function renderPillarOgCard(pillar: {
  eyebrow: string;
  title: string;
  ogHeadline?: { line1: string; line2: string };
}): Promise<ImageResponse> {
  const headline = pillar.ogHeadline ?? splitHeadline(pillar.title);
  return renderOgCard({
    eyebrow: pillar.eyebrow.toUpperCase(),
    line1: headline.line1,
    line2: headline.line2,
    name: "Matt Grant for Congress",
    footer: "Constituent resources · MO-02",
  });
}

// Per-game social card for the Four Fights arcade. Same brand as the apex/pillar
// cards (fonts, avatar, tri-color rule); the eyebrow is the game's issue, the
// headline is the game title with a brick "Play the game" CTA underneath.
export async function renderGameOgCard(game: { eyebrow: string; title: string }): Promise<ImageResponse> {
  return renderOgCard({
    eyebrow: game.eyebrow.toUpperCase(),
    line1: game.title,
    line2: "Play the game",
    name: "Matt Grant for Congress",
    footer: "Four Fights Arcade · games.mattgrantforcongress.org",
  });
}
