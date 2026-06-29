import { renderGameOgCard } from "@/lib/og";
import { orgChartContent } from "@/lib/games/org-chart";

// Per-game social card — Next attaches it to /games/org-chart (and is overridden by
// nothing below it). Brand + render live in lib/og.tsx (font fetch is non-fatal).
export const runtime = "nodejs";
export const alt = `${orgChartContent.title} — Four Fights Arcade`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderGameOgCard(orgChartContent);
}
