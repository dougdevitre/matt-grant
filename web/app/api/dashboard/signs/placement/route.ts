import { NextResponse, type NextRequest } from "next/server";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { parseCsv } from "@/lib/data/csv";
import { toCsv } from "@/lib/contacts/import";
import { hardFilter, scorePlacements, placementRows, rowToPlacement, PLACEMENT_OUTPUT_HEADERS } from "@/lib/signs/placement";

// Sign-placement scorer (the tool behind candidate/sign-placement-plan.md).
// POST the polling_sites / candidate-locations CSV (raw text/csv body) → download a ranked
// placement_output.csv. Pure: the scoring is lib/signs/placement.ts; this route is a thin adapter
// (parse CSV → hard-filter → score → CSV out). Field-targeting capability, re-checked here even
// though the page only renders for authorized roles.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { role } = await staffGate();
  if (!can(role, "viewTargets")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV body — post the locations CSV as the request body." }, { status: 400 });

  const { items } = parseCsv(text);
  if (items.length === 0) return NextResponse.json({ error: "No rows parsed — check the CSV header row." }, { status: 400 });

  const { kept, dropped } = hardFilter(items.map(rowToPlacement));
  const scored = scorePlacements(kept);
  const csv = toCsv(PLACEMENT_OUTPUT_HEADERS as unknown as string[], placementRows(scored));
  const today = new Date().toISOString().slice(0, 10);

  // Lead with a UTF-8 BOM so Excel opens accented names correctly; surface the filter tally in a
  // header so the caller sees how many candidates were dropped (out-of-district / no permission / buffer).
  return new NextResponse("﻿" + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="placement_output-${today}.csv"`,
      "cache-control": "no-store",
      "x-placement-kept": String(scored.length),
      "x-placement-dropped": String(dropped.length),
    },
  });
}
