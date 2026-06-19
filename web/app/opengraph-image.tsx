import { renderOgCard } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // render on demand; never block the build on the font fetch
export const alt = "Matt Grant for Congress — Missouri's 2nd District";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return renderOgCard({
    eyebrow: "MISSOURI · 2ND DISTRICT",
    line1: "Put Missouri's",
    line2: "children first.",
    name: "Matt Grant for Congress",
    footer: "Primary Election · August 4, 2026",
  });
}
