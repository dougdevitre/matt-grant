import { NextResponse } from "next/server";
import { getVotes } from "@/lib/integrations/legislative/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ bioguideId: string }> }) {
  const { bioguideId } = await params;
  const sp = new URL(req.url).searchParams;
  const year = sp.get("year") ? Number(sp.get("year")) : undefined;
  const position = sp.get("position") ?? undefined;
  try {
    const votes = await getVotes(bioguideId, { year, position });
    return NextResponse.json({ count: votes.length, votes });
  } catch {
    return NextResponse.json({ error: "research store unavailable" }, { status: 502 });
  }
}
