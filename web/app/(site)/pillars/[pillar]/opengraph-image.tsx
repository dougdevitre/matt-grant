import { notFound } from "next/navigation";
import { publicPillarSlugs, getPillar } from "@/lib/pillars";
import { renderPillarOgCard } from "@/lib/og";

// Per-pillar social card, colocated on the [pillar] segment so Next attaches it
// to the hub AND its descendant doc/tool pages automatically. Pre-rendered for
// each known pillar via generateStaticParams; the font fetch in lib/og.tsx is
// non-fatal, so a network-less build still emits a (default-font) card.
export const runtime = "nodejs";
export const alt = "Matt Grant for Congress — constituent resources";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return publicPillarSlugs.map((pillar) => ({ pillar }));
}

export default async function Image({ params }: { params: Promise<{ pillar: string }> }) {
  const { pillar: slug } = await params;
  const pillar = getPillar(slug);
  if (!pillar || pillar.hidden) notFound();
  return renderPillarOgCard(pillar);
}
