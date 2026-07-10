import { NextResponse, type NextRequest } from "next/server";
import { staffGate } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { parseCsv } from "@/lib/data/csv";
import { toCsv } from "@/lib/contacts/import";
import {
  hardFilter,
  normalizeTraffic,
  scorePlacements,
  placementRows,
  rowToPlacement,
  PLACEMENT_OUTPUT_HEADERS,
} from "@/lib/signs/placement";

// Sign-placement scorer (the tool behind candidate/sign-placement-plan.md §8).
// POST the polling_sites / candidate-locations CSV (raw text/csv body) → download a ranked
// placement_output.csv. Pure: the scoring is lib/signs/placement.ts; this route is a thin adapter
// (parse CSV → normalize traffic → hard-filter → score → CSV out). Field-targeting capability,
// re-checked here even though a page link only renders for authorized roles.
//
// The download carries the FULL audit trail: hard-filtered rows are appended at the bottom with a
// blank rank and a "DROPPED: <reasons>" note, so an operator can always see WHY a location was
// excluded (including the everything-dropped case when a gate column is missing from the CSV).
export const dynamic = "force-dynamic";

// Uploads are staff-tier accessible (viewTargets includes the volunteer role), so cap the body —
// a real locations CSV is a few hundred KB at most (repo precedent: asset upload caps at 15 MB,
// donor import caps rows; an uncapped req.text() is a memory-DoS surface).
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  const { role } = await staffGate();
  if (!can(role, "viewTargets")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Reject oversized bodies via the declared length where present, and re-check after reading
  // (chunked bodies carry no content-length).
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return NextResponse.json({ error: "CSV too large (2 MB max)" }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: "CSV too large (2 MB max)" }, { status: 413 });
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV body — post the locations CSV as the request body." }, { status: 400 });

  const { columns, items } = parseCsv(text);
  // A real locations CSV has a multi-column header including `name`; a JSON blob or an HTML error
  // page pasted by mistake parses to one giant column — reject it instead of returning a
  // plausible-looking header-only download.
  if (columns.length < 2 || !columns.includes("name")) {
    return NextResponse.json({ error: "Body doesn't look like a locations CSV (need a header row including `name`)." }, { status: 400 });
  }
  if (items.length === 0) return NextResponse.json({ error: "No rows parsed — check the CSV header row." }, { status: 400 });

  const normalized = normalizeTraffic(items.map(rowToPlacement));
  const { kept, dropped } = hardFilter(normalized);
  const scored = scorePlacements(kept);
  const csv = toCsv(PLACEMENT_OUTPUT_HEADERS as unknown as string[], placementRows(scored, dropped));
  const today = new Date().toISOString().slice(0, 10);

  // Lead with a UTF-8 BOM so Excel opens accented names correctly. Kept/dropped counts also ride
  // in headers for scripted callers; the dropped detail is in the CSV body itself.
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
