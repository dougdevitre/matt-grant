import { NextResponse } from "next/server";
import { z } from "zod";
import { withCors, preflight } from "@/lib/http/cors";
import { checkCap } from "@/lib/auth";
import { confirmChannelPosted } from "@/lib/social/schedule";
import { isChannelId, type ChannelId } from "@/lib/social/channels";
import { recordExtAction } from "@/lib/audit";
import { ok, fail, type Provenance } from "@/lib/data/resource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "social manual queue", kind: "api", live: true };

// POST /api/ext/social/posted — mark one channel of a staged post as posted after
// the staffer pasted it into the platform. Mirrors the dashboard's mark-posted
// form (confirmChannelPosted → status roll-up). manageSocial-gated, CORS, audited.
const Schema = z.object({
  id: z.string().trim().min(1).max(80),
  channel: z.string().trim().refine(isChannelId, "unknown channel"),
});

export async function POST(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("manageSocial");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const body = await req.json().catch(() => undefined);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return withCors(NextResponse.json(fail("invalid request", meta), { status: 400 }), req);
  try {
    const updated = await confirmChannelPosted(parsed.data.id, parsed.data.channel as ChannelId);
    if (!updated) return withCors(NextResponse.json(fail("post or channel not found", meta), { status: 404 }), req);
    await recordExtAction({
      at: new Date().toISOString(),
      actor: gate.email ?? "unknown",
      action: "social.markPosted",
      target: `${parsed.data.id}#${parsed.data.channel}`,
    });
    return withCors(NextResponse.json(ok({ id: parsed.data.id, channel: parsed.data.channel }, { ...meta, count: 1 })), req);
  } catch {
    return withCors(NextResponse.json(fail("could not update post", meta), { status: 502 }), req);
  }
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
