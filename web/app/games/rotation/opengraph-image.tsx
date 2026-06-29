import { renderGameOgCard } from "@/lib/og";
import { rotationContent } from "@/lib/games/rotation";

// Per-game social card — Next attaches it to /games/rotation (and is overridden by
// nothing below it). Brand + render live in lib/og.tsx (font fetch is non-fatal).
export const runtime = "nodejs";
export const alt = `${rotationContent.title} — Four Fights Arcade`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderGameOgCard(rotationContent);
}
