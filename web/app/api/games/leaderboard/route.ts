import { NextResponse } from "next/server";
import { topScores } from "@/lib/games/server/store";
import { isGameId } from "@/lib/games/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Top-N anonymous scores for one game. PII-free by construction — the store only ever
// holds initials + score (see lib/games/server/store.ts). Cached briefly at the edge.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const game = url.searchParams.get("game") ?? "";
  if (!isGameId(game)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10) || 10, 1), 50);
  const entries = await topScores(game, limit);
  return NextResponse.json(
    { game, entries: entries.map((e) => ({ initials: e.initials, score: e.score })) },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } },
  );
}
