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

async function googleFont(family: string, weight: number, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
  const src = css.match(/src: url\((https:[^)]+)\) format/);
  if (!src) throw new Error(`font fetch failed for ${family}`);
  return fetch(src[1]).then((r) => r.arrayBuffer());
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
      fonts: [
        { name: "Fraunces", data: fraunces, weight: 700, style: "normal" },
        { name: "Public Sans", data: publicSans, weight: 600, style: "normal" },
      ],
    },
  );
}
