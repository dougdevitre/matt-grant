import { NextResponse } from "next/server";
import { gameFlags } from "@/lib/games/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-game enabled/kill-switch state. The menu reads this so compliance can pull a
// game (flip its SSM flag to false) WITHOUT a deploy. Read-only, briefly cached.

export async function GET() {
  const flags = await gameFlags();
  return NextResponse.json(
    { flags },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } },
  );
}
