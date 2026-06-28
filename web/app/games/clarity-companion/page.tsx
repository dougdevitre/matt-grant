import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClarityCompanion } from "@/components/games/ClarityCompanion";
import { clarityContent } from "@/lib/games/clarity-companion";
import { gameFlags } from "@/lib/games/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // respect the live kill switch / compliance gate

export const metadata: Metadata = {
  title: "Clarity Companion",
  description: "Open the public record, protect the child, redact the rest — transparency and privacy together.",
};

// NOTE: this game ships behind the registry flag (default OFF). The route 404s until
// the flag is enabled after the compliance/tone review — see docs/games.md.
export default async function ClarityCompanionPage() {
  const flags = await gameFlags();
  if (flags["clarity-companion"] === false) notFound();
  return <ClarityCompanion content={clarityContent} />;
}
