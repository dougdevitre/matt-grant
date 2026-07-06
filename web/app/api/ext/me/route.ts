import { NextResponse } from "next/server";
import { checkCap } from "@/lib/auth";
import { withCors, preflight } from "@/lib/http/cors";
import { ok, fail, type Provenance } from "@/lib/data/resource";
import { type Role } from "@/lib/rbac";
import { gatherPersonalSignals } from "@/lib/dashboard/personal-data";
import { nextStep, buildChecklist, checklistProgress } from "@/lib/dashboard/personal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const meta: Provenance = { source: "my next step", kind: "api", live: true };

// Extension: the SIGNED-IN staffer's own "what to do next" — the single suggested
// next step + readiness checklist that the dashboard's PersonalSummary shows atop
// /dashboard. Gated on viewOverview (all staff tiers). Hand-written (not extRoute)
// because it needs the caller's identity: the payload is derived from gate.email, so
// it is inherently self-scoped and leaks nobody else's data. Identity is
// server-derived — there is no id in the path or body.
export async function GET(req: Request): Promise<Response> {
  const { allowed, gate } = await checkCap("viewOverview");
  if (!allowed) return withCors(NextResponse.json(fail("forbidden", meta), { status: 403 }), req);
  try {
    // Default an unresolved role to admin — the same convention the dashboard's
    // PersonalSummary uses (app/dashboard/page.tsx, layout.tsx). checkCap already
    // gated viewOverview, so this only affects the null-role edge; it just picks the
    // "leadership" nextStep branch rather than the member one.
    const role = (gate.role ?? "admin") as Role;
    const signals = await gatherPersonalSignals(gate.email, role);
    const checklist = buildChecklist(signals);
    const data = {
      nextStep: nextStep(signals),
      checklist,
      progress: checklistProgress(checklist),
      captainName: signals.captainName,
      daysToPrimary: signals.daysToPrimary,
    };
    return withCors(NextResponse.json(ok(data, meta)), req);
  } catch {
    return withCors(NextResponse.json(fail("source unavailable", meta), { status: 502 }), req);
  }
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
