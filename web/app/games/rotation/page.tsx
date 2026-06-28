import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RotationGame } from "@/components/games/RotationGame";
import { GameAccessGate } from "@/components/games/GameAccessGate";
import { rotationContent } from "@/lib/games/rotation";
import { gameFlags } from "@/lib/games/server/store";
import { clerkEnabled } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // respect the live kill switch

export const metadata: Metadata = {
  title: "Rotation",
  description: "Rotate each seat at the service sweet spot — too early wastes the ramp, too late is careerism.",
};

export default async function RotationPage() {
  const flags = await gameFlags();
  if (flags["rotation"] === false) notFound(); // compliance kill switch
  return (
    <GameAccessGate gameId="rotation" clerkEnabled={clerkEnabled}>
      <RotationGame content={rotationContent} />
    </GameAccessGate>
  );
}
