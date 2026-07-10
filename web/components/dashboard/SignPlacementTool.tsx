"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { parseCsv } from "@/lib/data/csv";
import { toCsv } from "@/lib/contacts/import";
import {
  hardFilter,
  normalizeTraffic,
  scorePlacements,
  allocateToCaptains,
  rowToPlacement,
  rowToCaptain,
  placementRows,
  PLACEMENT_OUTPUT_HEADERS,
  type ScoredPlacement,
  type PlacementType,
} from "@/lib/signs/placement";

// Browser front-end for the sign-placement scorer (candidate/sign-placement-plan.md §8).
// Everything runs client-side: lib/signs/placement.ts and the CSV helpers are pure, so pasting
// a CSV gives a live ranked preview with no upload — the same pipeline as the
// /api/dashboard/signs/placement route, so the download here matches the route's byte-for-byte
// (minus BOM). Mirrors DonorImport (textarea + live preview) and TargetTable (table + Blob download).

// MapLibre touches window/WebGL — load client-only, same as MapExplorer's RegionMap3D import.
const SignsMap = dynamic(() => import("@/components/dashboard/SignsMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-ink/5 text-sm text-slate">Loading map…</div>
  ),
});

const tierColor: Record<ScoredPlacement["tier"], string> = {
  A: "bg-brick/12 text-brick",
  B: "bg-gold/20 text-blue-ink",
  C: "bg-line text-slate",
};

const field =
  "w-full rounded-sm border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-field";

const LOCATIONS_HINT =
  "name,lat,lng,site_type,days_active,in_district,buffer_verified,property_permission,captain_id,assigned_volunteer,precinct,aadt,propensity,visibility,serviceability,voter_contact_value,notes";
const CAPTAINS_HINT = "id,name,zone_name,zone_precincts,contact,sign_inventory";

export function SignPlacementTool() {
  const [locText, setLocText] = useState("");
  const [capText, setCapText] = useState("");

  // Parse + score live. parseCsv never throws (returns empty on garbage), and every scoring
  // function is pure, so this is safe to run per keystroke via useMemo.
  const result = useMemo(() => {
    const trimmed = locText.trim();
    if (!trimmed) return null;
    const { columns, items } = parseCsv(trimmed);
    if (columns.length < 2 || !columns.includes("name") || items.length === 0) {
      return { error: "That doesn't look like a locations CSV — the header row must include `name` (see the schema hint above)." } as const;
    }
    const normalized = normalizeTraffic(items.map(rowToPlacement));
    const { kept, dropped } = hardFilter(normalized);
    const scored = scorePlacements(kept);
    // Deploy order (same as the CSV): sites first — early-vote funded off the top — then corridors.
    const byFamilyRank = (fam: PlacementType[]) =>
      scored.filter((p) => fam.includes(p.type)).sort((a, b) => a.rank - b.rank);
    const ordered = [...byFamilyRank(["site"]), ...byFamilyRank(["corridor", "residential"])];

    const capTrimmed = capText.trim();
    let allocation: ReturnType<typeof allocateToCaptains> | null = null;
    if (capTrimmed) {
      const caps = parseCsv(capTrimmed).items.map(rowToCaptain).filter((c) => c.id);
      if (caps.length) allocation = allocateToCaptains(scored, caps);
    }
    return { ordered, scored, dropped, allocation } as const;
  }, [locText, capText]);

  // GeoJSON for the map — only rows with valid lat/lng plot; a CSV with no coordinates just
  // shows an empty map rather than erroring (the tables above still work either way).
  const mapData = useMemo(() => {
    if (!result || "error" in result) return null;
    const hasLatLng = <P extends { lat?: number; lng?: number }>(p: P): p is P & { lat: number; lng: number } =>
      typeof p.lat === "number" && typeof p.lng === "number";
    const placements: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: result.scored.filter(hasLatLng).map((p) => ({
        type: "Feature",
        properties: { name: p.name, type: p.type, tier: p.tier, score: p.score, captainId: p.captainId ?? "", precinct: p.precinct ?? "" },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    };
    const droppedFc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: result.dropped
        .filter((d) => hasLatLng(d.row))
        .map((d) => ({
          type: "Feature",
          properties: { name: d.row.name, reasons: d.reasons.join("; ") },
          geometry: { type: "Point", coordinates: [d.row.lng as number, d.row.lat as number] },
        })),
    };
    return { placements, dropped: droppedFc };
  }, [result]);

  const download = () => {
    if (!result || "error" in result) return;
    const csv = toCsv(PLACEMENT_OUTPUT_HEADERS as unknown as string[], placementRows(result.scored, result.dropped));
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `placement_output-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <label className="text-xs font-semibold text-slate" htmlFor="signs-locations">
            Locations CSV (required)
          </label>
          <p className="mb-2 mt-1 break-all font-mono text-[0.6rem] text-slate">{LOCATIONS_HINT}</p>
          <textarea
            id="signs-locations"
            value={locText}
            onChange={(e) => setLocText(e.target.value)}
            rows={8}
            className={field}
            placeholder={'name,lat,lng,site_type,days_active,in_district,buffer_verified,property_permission\n"Daniel Boone Library",38.6031,-90.5673,early_vote_and_eday,14,true,true,true'}
          />
        </div>
        <div className="card p-5">
          <label className="text-xs font-semibold text-slate" htmlFor="signs-captains">
            Captains CSV (optional — adds turf packets)
          </label>
          <p className="mb-2 mt-1 break-all font-mono text-[0.6rem] text-slate">{CAPTAINS_HINT}</p>
          <textarea
            id="signs-captains"
            value={capText}
            onChange={(e) => setCapText(e.target.value)}
            rows={8}
            className={field}
            placeholder={'id,name,sign_inventory\nC01,"Maria Lopez",250'}
          />
        </div>
      </div>

      {!result && (
        <p className="text-sm text-slate">
          Paste the locations CSV to see the ranked deploy list. Rows failing a hard gate
          (out-of-district, no permission, buffer unverified) are never scored — they appear below
          with reasons instead.
        </p>
      )}

      {result && "error" in result && <p className="text-sm text-brick">{result.error}</p>}

      {result && !("error" in result) && (
        <>
          {/* Summary + download */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-sm bg-field/10 px-3 py-1.5 font-mono text-xs font-bold text-field">
              {result.scored.length} deployable
            </span>
            <span className={`rounded-sm px-3 py-1.5 font-mono text-xs font-bold ${result.dropped.length ? "bg-brick/10 text-brick" : "bg-line text-slate"}`}>
              {result.dropped.length} dropped
            </span>
            <span className="rounded-sm bg-gold/15 px-3 py-1.5 font-mono text-xs font-bold text-gold-ink">
              {result.scored.filter((p) => p.tier === "A").length} tier A
            </span>
            <button type="button" onClick={download} className="btn-ghost ml-auto" disabled={result.scored.length === 0 && result.dropped.length === 0}>
              Download placement_output.csv
            </button>
          </div>

          {/* Map — plots every scored/dropped row that has lat/lng; click a pin for details */}
          {mapData && (mapData.placements.features.length > 0 || mapData.dropped.features.length > 0) && (
            <>
              <div className="h-[50vh] min-h-[360px] overflow-hidden rounded-lg border border-line shadow-card">
                <SignsMap placements={mapData.placements} dropped={mapData.dropped} />
              </div>
              <p className="text-xs text-slate">
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#B5343B" }} aria-hidden />
                Tier A ·{" "}
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#2563EB" }} aria-hidden />
                Tier B ·{" "}
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: "#5A6472" }} aria-hidden />
                Tier C ·{" "}
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full border border-brick align-middle opacity-50" style={{ background: "#B5343B" }} aria-hidden />
                Dropped (hard-gate failure). Rows without lat/lng don&apos;t plot but still appear in the tables below.
              </p>
            </>
          )}

          {/* Ranked deploy table */}
          {result.ordered.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-paper text-left text-slate">
                    <tr>
                      {["#", "Name", "Type", "Tier", "Score", "Captain", "Volunteer", "Precinct"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.ordered.map((p, i) => (
                      <tr key={`${p.name}-${i}`} className="hover:bg-paper">
                        <td className="px-4 py-2.5 font-mono text-slate">{i + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-ink">{p.name}</td>
                        <td className="px-4 py-2.5 text-slate">{p.type}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.65rem] font-bold ${tierColor[p.tier]}`}>{p.tier}</span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-ink">{p.score.toFixed(4)}</td>
                        <td className="px-4 py-2.5 font-mono text-slate">{p.captainId || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-slate">{p.assignedVolunteer || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-slate">{p.precinct || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dropped — the audit trail */}
          {result.dropped.length > 0 && (
            <div className="card overflow-hidden p-0">
              <p className="border-b border-line bg-paper px-4 py-3 font-mono text-[0.65rem] uppercase tracking-eyebrow text-brick">
                Dropped by hard gates — fix and re-paste (never place these as-is)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {result.dropped.map((d, i) => (
                      <tr key={`${d.row.name}-${i}`} className="hover:bg-paper">
                        <td className="px-4 py-2.5 font-semibold text-ink">{d.row.name || "(unnamed row)"}</td>
                        <td className="px-4 py-2.5 text-brick">{d.reasons.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Turf packets */}
          {result.allocation && (
            <div className="card overflow-hidden p-0">
              <p className="border-b border-line bg-paper px-4 py-3 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">
                Turf packets — {result.allocation.totals.assigned} assigned · {result.allocation.totals.needsHost} need a host
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-paper text-left text-slate">
                    <tr>
                      {["Captain", "Locations", "Inventory", "Flags", "Top placements"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-4 py-3 font-mono text-[0.65rem] uppercase tracking-eyebrow">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {result.allocation.packets.map((pk) => (
                      <tr key={pk.captainId} className="hover:bg-paper">
                        <td className="px-4 py-2.5 font-semibold text-ink">{pk.name || pk.captainId}</td>
                        <td className="px-4 py-2.5 font-mono text-ink">{pk.count}</td>
                        <td className="px-4 py-2.5 font-mono text-slate">{pk.signInventory ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {pk.overCapacity && <span className="mr-2 rounded-sm bg-brick/10 px-2 py-0.5 font-mono text-[0.65rem] font-bold text-brick">over inventory</span>}
                          {pk.overSpan && <span className="rounded-sm bg-gold/15 px-2 py-0.5 font-mono text-[0.65rem] font-bold text-gold-ink">over span</span>}
                          {!pk.overCapacity && !pk.overSpan && <span className="text-slate">ok</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate">
                          {pk.placements.slice(0, 3).map((p) => p.name).join(", ")}
                          {pk.count > 3 ? ` +${pk.count - 3} more` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.allocation.needsHost.length > 0 && (
                <p className="border-t border-line px-4 py-3 text-xs text-slate">
                  <span className="font-semibold text-brick">Needs host:</span>{" "}
                  {result.allocation.needsHost.map((p) => p.name).join(", ")} — no matching captain;
                  assign a captain_id or recruit a host before deploying.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
