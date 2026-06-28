import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RedTapeRun } from "@/components/games/RedTapeRun";
import { GameAccessGate } from "@/components/games/GameAccessGate";
import { redTapeRunContent } from "@/lib/games/red-tape-run";
import { gameFlags } from "@/lib/games/server/store";
import { clerkEnabled } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // respect the live kill switch

export const metadata: Metadata = {
  title: "Red Tape Run",
  description: "Dodge the procedural abuses in family court and grab the reforms — a fair shot for kids.",
};

export default async function RedTapeRunPage() {
  const flags = await gameFlags();
  if (flags["red-tape-run"] === false) notFound(); // compliance kill switch
  return (
    <GameAccessGate gameId="red-tape-run" clerkEnabled={clerkEnabled}>
      <RedTapeRun content={redTapeRunContent} />
    </GameAccessGate>
  );
}
