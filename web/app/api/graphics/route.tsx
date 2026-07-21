import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CAMPAIGN } from "@/lib/site";
import { trimHeadline } from "@/lib/social/headline";
import { brandFonts } from "@/lib/fonts/brandFonts";
import { GRAPHIC_FORMATS, layoutFor, fitHeadline } from "@/lib/social/graphicLayout";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Server-side campaign-graphic generator. Composites Matt's photo + custom copy
// into branded social/print formats, in the current red/white/blue identity with a
// real editorial serif (Fraunces) headline that auto-fits its box. The headline is
// sized + wrapped by the pure lib/social/graphicLayout helpers (satori can't measure
// text at render time), so the type always fills the card with even margins whatever
// the character count. Layout is a clean flex COLUMN root — rule, content(flex:1),
// disclaimer — with a per-family inner composition.
export const runtime = "nodejs";

const EYEBROW = "MISSOURI · DISTRICT 2";

// Red / white / blue themes. `brick` (red ground) is the featured look + default.
const THEMES: Record<string, { bg: string; text: string; dim: string; eyebrow: string; ring: string }> = {
  brick: { bg: "#B5343B", text: "#FBFAF6", dim: "#F2D6D8", eyebrow: "#CFE4FF", ring: "#FBFAF6" },
  navy: { bg: "#0F2540", text: "#FBFAF6", dim: "#AEBBD0", eyebrow: "#6BA6FF", ring: "#6BA6FF" },
  paper: { bg: "#FBFAF6", text: "#0F2540", dim: "#5A6472", eyebrow: "#B5343B", ring: "#B5343B" },
};
const RULE = { brick: "#B5343B", paper: "#FBFAF6", blue: "#6BA6FF" };

async function avatarDataUri(): Promise<string> {
  const buf = await readFile(path.join(process.cwd(), "public", "brand", "avatar-circle.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function GET(req: Request) {
  // Public, renders arbitrary user text via satori (CPU/memory-heavy) with an
  // infinitely-varying cache key — rate-limit so an anonymous loop can't pin
  // Lambda compute or run up hosting cost.
  const rl = await rateLimit(`graphics:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return new Response("Too many requests — please slow down.", { status: 429 });

  const sp = new URL(req.url).searchParams;
  const fmt = GRAPHIC_FORMATS[(sp.get("format") ?? "ig_square") as keyof typeof GRAPHIC_FORMATS] ?? GRAPHIC_FORMATS.ig_square;
  const theme = THEMES[sp.get("theme") ?? "brick"] ?? THEMES.brick;
  const headline = trimHeadline(sp.get("headline") ?? "Put Missouri's children first.", 120);
  const sub = (sp.get("sub") ?? "Matt Grant for Congress").slice(0, 90);
  const showPhoto = sp.get("photo") !== "0";
  const hasSub = sub.trim().length > 0;

  const { w, h } = fmt;
  const L = layoutFor(fmt, { photo: showPhoto, hasSub });
  const wide = L.family === "wide";
  const disclaimer = wide ? CAMPAIGN.paidForBy : `${CAMPAIGN.paidForBy} · mattgrantforcongress.org`;

  // Real type: Fraunces (serif) headline + Public Sans labels, self-hosted (see
  // lib/fonts/brandFonts.ts) so a Google Fonts outage can't silently downgrade the
  // brand typeface or the disclaimer's look on the image.
  const sansText = EYEBROW + sub + disclaimer + "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·.,'—-";
  const [fonts, photo] = await Promise.all([
    brandFonts(headline, sansText),
    showPhoto ? avatarDataUri() : Promise.resolve(null),
  ]);

  const fit = fitHeadline({
    text: headline,
    boxW: L.textBoxW,
    boxH: L.headlineBoxH,
    maxFont: L.headlineMaxFont,
    minFont: L.headlineMinFont,
    maxLines: L.family === "portrait" ? 6 : 5,
  });

  const align = wide ? "flex-start" : "center";
  const textAlign = wide ? "left" : "center";

  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, width: wide ? L.textBoxW : "100%", gap: L.gapV }}>
      <div style={{ display: "flex", color: theme.eyebrow, fontSize: L.eyebrowSize, fontWeight: 600, letterSpacing: Math.round(L.eyebrowSize * 0.24) }}>
        {EYEBROW}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: align, fontFamily: "Fraunces", fontWeight: 700, fontSize: fit.fontSize, lineHeight: fit.lineHeight, color: theme.text, textAlign }}>
        {fit.lines.map((line, i) => (
          <div key={i} style={{ display: "flex", whiteSpace: "nowrap" }}>{line}</div>
        ))}
      </div>
      {hasSub && <div style={{ display: "flex", color: theme.dim, fontSize: L.subSize, fontWeight: 600 }}>{sub}</div>}
    </div>
  );

  const photoEl = photo ? (
    <div style={{ display: "flex", width: L.avatar, height: L.avatar, borderRadius: L.avatar, border: `${Math.max(3, Math.round(L.avatar * 0.02))}px solid ${theme.ring}`, overflow: "hidden", flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} width={L.avatar} height={L.avatar} style={{ objectFit: "cover" }} alt="" />
    </div>
  ) : null;

  const content = wide ? (
    <div style={{ display: "flex", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", gap: L.colGap, padding: `0 ${L.padX}px` }}>
      {textBlock}
      {photoEl}
    </div>
  ) : (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", gap: Math.round(L.gapV * 1.6), padding: `${L.padY}px ${L.padX}px 0` }}>
      {photoEl}
      {textBlock}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: theme.bg, fontFamily: "Public Sans" }}>
        {/* Tri-color rule (red / white / blue) — in-flow at the very top. */}
        <div style={{ display: "flex", width: "100%", height: L.ruleH }}>
          <div style={{ display: "flex", flex: 1, background: RULE.brick }} />
          <div style={{ display: "flex", flex: 1, background: RULE.paper }} />
          <div style={{ display: "flex", flex: 1, background: RULE.blue }} />
        </div>

        {content}

        {/* Required FEC disclaimer — these graphics are downloaded and posted as
            standalone public communications, so the "Paid for by" line must appear
            on the image itself, in-flow at the bottom at a legible size. */}
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: wide ? "flex-start" : "center",
            padding: `0 ${L.padX}px ${Math.round(L.padY * 0.7)}px`,
            color: theme.dim,
            fontSize: L.discSize,
            fontWeight: 600,
          }}
        >
          {disclaimer}
        </div>
      </div>
    ),
    { width: w, height: h, ...(fonts.length ? { fonts } : {}) },
  );
}
