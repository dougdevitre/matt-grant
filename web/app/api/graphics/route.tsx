import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CAMPAIGN } from "@/lib/site";
import { trimHeadline } from "@/lib/social/headline";

// Server-side campaign-graphic generator. Composites Matt's photo + custom copy
// into branded social/print formats. Reads the processed avatar from /public.
export const runtime = "nodejs";

const FORMATS: Record<string, { w: number; h: number; label: string }> = {
  ig_square: { w: 1080, h: 1080, label: "Instagram / FB square" },
  ig_story: { w: 1080, h: 1920, label: "Instagram / FB story" },
  x_header: { w: 1500, h: 500, label: "X / Twitter header" },
  fb_cover: { w: 1640, h: 624, label: "Facebook cover" },
  yard_sign: { w: 1100, h: 825, label: "Yard sign (24×18)" },
  web_banner: { w: 1200, h: 400, label: "Web banner" },
};

const THEMES: Record<string, { bg: string; accent: string; text: string; muted: string }> = {
  navy: { bg: "#0F2540", accent: "#E0A53B", text: "#FBFAF6", muted: "#9fb0c2" },
  gold: { bg: "#E0A53B", accent: "#0F2540", text: "#0F2540", muted: "#5a4a1f" },
  brick: { bg: "#B5343B", accent: "#E0A53B", text: "#FBFAF6", muted: "#f0cdcf" },
};

async function avatarDataUri(): Promise<string> {
  const buf = await readFile(path.join(process.cwd(), "public", "brand", "avatar-circle.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const fmt = FORMATS[sp.get("format") ?? "ig_square"] ?? FORMATS.ig_square;
  const theme = THEMES[sp.get("theme") ?? "navy"] ?? THEMES.navy;
  const headline = trimHeadline(sp.get("headline") ?? "Put Missouri's children first.", 120);
  const sub = (sp.get("sub") ?? "Matt Grant for Congress").slice(0, 90);
  const showPhoto = sp.get("photo") !== "0";

  const { w, h } = fmt;
  const wide = w > h * 1.3;
  const photo = showPhoto ? await avatarDataUri() : null;
  const photoSize = wide ? Math.round(h * 0.7) : Math.round(Math.min(w, h) * 0.42);
  // Scale the headline down as it gets longer so it always fits the card instead of
  // overflowing and clipping against the bottom "Paid for by" line.
  const hlLen = headline.length;
  const hlScale = hlLen <= 24 ? 1 : hlLen <= 40 ? 0.86 : hlLen <= 60 ? 0.72 : hlLen <= 90 ? 0.6 : 0.5;
  const headSize = Math.round((wide ? h * 0.16 : w * 0.085) * hlScale);

  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: Math.round(h * 0.02), maxWidth: wide ? "62%" : "100%" }}>
      <div style={{ display: "flex", color: theme.accent, fontSize: Math.round(headSize * 0.32), letterSpacing: 5 }}>
        MISSOURI · DISTRICT 2
      </div>
      <div style={{ display: "flex", color: theme.text, fontSize: headSize, fontWeight: 700, lineHeight: 1.04 }}>
        {headline}
      </div>
      <div style={{ display: "flex", color: theme.muted, fontSize: Math.round(headSize * 0.42) }}>{sub}</div>
    </div>
  );

  const photoEl = photo ? (
    <div style={{ display: "flex", width: photoSize, height: photoSize, borderRadius: photoSize, border: `${Math.round(photoSize * 0.02)}px solid ${theme.accent}`, overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} width={photoSize} height={photoSize} style={{ objectFit: "cover" }} alt="" />
    </div>
  ) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: wide ? "row" : "column",
          alignItems: "center",
          justifyContent: wide ? "space-between" : "center",
          gap: Math.round(Math.min(w, h) * 0.05),
          background: theme.bg,
          // Extra bottom padding reserves room for the absolutely-positioned
          // "Paid for by" line so the headline never overlaps it.
          padding: `${Math.round(h * 0.08)}px ${Math.round(w * 0.07)}px ${Math.round(h * 0.16)}px`,
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: "100%", height: Math.max(8, Math.round(h * 0.014)), background: theme.accent }} />
        {wide ? (
          <>
            {textBlock}
            {photoEl}
          </>
        ) : (
          <>
            {photoEl}
            {textBlock}
          </>
        )}
        {/* Required FEC disclaimer — these graphics are downloaded and posted as
            standalone public communications, so the "Paid for by" line must appear
            on the image itself (not just the site footer). Wide formats keep it to a
            single line (no domain) so it never clips against the short bottom margin. */}
        <div style={{ display: "flex", position: "absolute", bottom: Math.round(h * 0.05), left: Math.round(w * 0.07), maxWidth: wide ? "86%" : "86%", color: theme.muted, fontSize: Math.round(headSize * (wide ? 0.2 : 0.3)), lineHeight: 1.2 }}>
          {wide ? CAMPAIGN.paidForBy : `${CAMPAIGN.paidForBy} · mattgrantforcongress.org`}
        </div>
      </div>
    ),
    { width: w, height: h },
  );
}
