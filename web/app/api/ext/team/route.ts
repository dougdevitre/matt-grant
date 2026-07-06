import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { withCors, preflight } from "@/lib/http/cors";
import { ok, fail, type Provenance } from "@/lib/data/resource";
import { getCaptainTeam } from "@/lib/volunteers/team";
import { listCaptainEvents } from "@/lib/events";
import { gatherCaptainScorecard } from "@/lib/volunteers/score-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "my team", kind: "api", live: true };

// Extension: the SIGNED-IN captain's OWN team at a glance — their claimed volunteers,
// their team-health summary (the captain scorecard), and their upcoming owned events.
// Gated on manageVolunteers (captain + admin). Hand-written (not extRoute) because
// every read is scoped to gate.email: a captain can only ever see their own team, and
// an admin (who leads no team of their own) gets an empty roster + null summary rather
// than the whole roster. Identity is server-derived — no id in the path.
export async function GET(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("manageVolunteers");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  const email = gate.email ?? null;
  try {
    const [summary, roster, events] = await Promise.all([
      gatherCaptainScorecard(email ?? ""),
      getCaptainTeam(email),
      listCaptainEvents(email),
    ]);
    const data = {
      // Team-health signals + score (rosterSize / contactable / activated / engaged /
      // recentEvents). Null when the caller isn't an active captain (e.g. an admin).
      summary,
      // Trimmed roster for a popup glance — no phone/email dump, just who + status.
      roster: roster.map((v) => ({
        id: v.id,
        name: v.name,
        status: v.status,
        city: v.city,
        lastContactedAt: v.lastContactedAt,
      })),
      // The caller's own upcoming appearances, soonest first.
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        start: e.start,
        status: e.status,
        location: e.location?.name || e.location?.city || "",
      })),
    };
    return withCors(NextResponse.json(ok(data, { ...meta, count: roster.length })), req);
  } catch {
    return withCors(NextResponse.json(fail("source unavailable", meta), { status: 502 }), req);
  }
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
