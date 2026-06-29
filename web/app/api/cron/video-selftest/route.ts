import { type NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { renderStillToMp4 } from "@/lib/social/video";

// Ops self-test for the YouTube-Short render path. Gated by the same CRON_SECRET as
// the other cron routes. Renders a known still to an in-memory MP4 (NO upload, no side
// effects) and reports whether ffmpeg resolved (local vs the S3 binary), the output
// size, and the wall-clock time — so we can confirm render works on the Amplify SSR
// runtime and whether a cold render fits the timeout budget. Safe to keep as a probe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // headroom so the diagnostic measures the true render time

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = new URL(req.url).origin;
  const imageUrl = `${origin}/opengraph-image`; // always-present 1200×630 PNG
  const t0 = Date.now();
  try {
    const mp4 = await renderStillToMp4(imageUrl, 2); // 2s render is enough to prove the pipeline
    return NextResponse.json({ ok: true, bytes: mp4.length, ms: Date.now() - t0, image: imageUrl });
  } catch (e) {
    return NextResponse.json(
      { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) },
      { status: 200 }, // 200 so the body (the diagnostic) is easy to read
    );
  }
}

export const GET = handle;
export const POST = handle;
