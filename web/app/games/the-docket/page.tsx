import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TheDocket } from "@/components/games/TheDocket";
import { docketContent } from "@/lib/games/the-docket";
import { gameFlags } from "@/lib/games/server/store";
import { clerkEnabled } from "@/lib/auth";
import { GameAccessGate } from "@/components/games/GameAccessGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Docket",
  description: "Protect a child's childhood before a rigged system devours it.",
};

// PHASE 1 prototype: flag defaults OFF (route 404s in prod). Enable for local/preview
// review via GAMES_FLAGS={"the-docket":true} once the framing is signed off.
export default async function TheDocketPage() {
  const flags = await gameFlags();
  if (flags["the-docket"] !== true) notFound();
  return (
    <GameAccessGate gameId="the-docket" clerkEnabled={clerkEnabled}>
      <TheDocket content={docketContent} />
    </GameAccessGate>
  );
}
