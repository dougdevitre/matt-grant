import { NextResponse } from "next/server";
import { getMember } from "@/lib/integrations/legislative/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ bioguideId: string }> }) {
  const { bioguideId } = await params;
  try {
    const member = await getMember(bioguideId);
    if (!member) return NextResponse.json({ error: "not ingested yet" }, { status: 404 });
    return NextResponse.json({ member });
  } catch {
    return NextResponse.json({ error: "research store unavailable" }, { status: 502 });
  }
}
