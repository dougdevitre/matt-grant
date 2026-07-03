import { NextResponse } from "next/server";
import { loadChildActBills } from "@/lib/analysis/childActView";

// CHILD Act synthesis — the family-court relevance view over the ingested
// Congress.gov record (candidate/issues-to-action-data-synthesis-plan.md §3.1).
// The synthesis lives in lib/analysis/childActView.ts so the dashboard read view
// (app/dashboard/data/[id]) renders exactly what this endpoint returns.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadChildActBills());
}
