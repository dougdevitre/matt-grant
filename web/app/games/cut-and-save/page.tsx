import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CutAndSave } from "@/components/games/CutAndSave";
import { GameAccessGate } from "@/components/games/GameAccessGate";
import { cutSaveContent } from "@/lib/games/cut-and-save";
import { gameFlags } from "@/lib/games/server/store";
import { clerkEnabled } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // respect the live kill switch

export const metadata: Metadata = {
  title: "Cut & Save",
  description: "Cut the waste to fund tax relief — without harming families or borrowing.",
};

export default async function CutAndSavePage() {
  const flags = await gameFlags();
  if (flags["cut-and-save"] === false) notFound(); // compliance kill switch
  return (
    <GameAccessGate gameId="cut-and-save" clerkEnabled={clerkEnabled}>
      <CutAndSave content={cutSaveContent} />
    </GameAccessGate>
  );
}
