import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { getCandidate } from "@/lib/integrations/research/candidates";
import { getTimeline } from "@/lib/integrations/research/store";
import { buildTimeline } from "@/lib/integrations/research/timeline";

// Verifiable tenure timeline for one candidate — per-Congress terms + bills +
// per-cycle fundraising/independent-expenditures, each with a source_url.
// Reads the stored series (populated by the ingest); falls back to building it
// live so it works before the next ingest run. Public data, read-only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("candidate");
  if (!slug) return NextResponse.json({ error: "pass ?candidate=<slug>" }, { status: 400 });

  const c = getCandidate(slug);
  if (!c) return NextResponse.json({ error: `unknown candidate: ${slug}` }, { status: 404 });

  // Prefer the stored series; build live if it isn't there yet.
  if (dbConfigured) {
    try {
      const stored = await getTimeline(slug);
      if (stored) return NextResponse.json(stored, { headers: { "cache-control": "public, max-age=3600" } });
    } catch {
      /* fall through to live build */
    }
  }

  try {
    const timeline = await buildTimeline(c);
    return NextResponse.json(timeline, { headers: { "cache-control": "public, max-age=3600" } });
  } catch (err) {
    console.error("[research/timeline]", err);
    return NextResponse.json({ error: "Timeline build failed" }, { status: 502 });
  }
}
