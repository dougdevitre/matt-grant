import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { reconcileStaffRoles } from "@/lib/clerkRoles";

// Bearer-gated (CRON_SECRET) reconcile pass: re-stamp Clerk publicMetadata.role
// from the durable DynamoDB staff rows for any signed-up staffer whose Clerk role
// has drifted (e.g. a best-effort Clerk write failed after a team-page role change,
// or a webhook was missed). The webhook keeps them in sync in real time; this is
// the periodic safety net. Safe to run often — it only touches active staff rows
// and only writes when a value actually differs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: NextRequest) {
  if (!(await cronAuthorized(req))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await reconcileStaffRoles();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: false, error: "reconcile failed" }, { status: 502 });
  }
}

export const GET = handle;
export const POST = handle;
