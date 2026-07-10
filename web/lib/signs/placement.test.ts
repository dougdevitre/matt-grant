import { describe, it, expect } from "vitest";
import {
  hardFilter,
  normalizeTraffic,
  placementScore,
  scorePlacements,
  allocateToCaptains,
  distanceMeters,
  rowToPlacement,
  rowToCaptain,
  poiToPlacement,
  placementRows,
  PLACEMENT_OUTPUT_HEADERS,
  type PlacementInput,
} from "./placement";

const base: PlacementInput = {
  name: "x",
  type: "corridor",
  inDistrict: true,
  bufferVerified: true,
  propertyPermission: true,
};

describe("hardFilter", () => {
  it("drops rows failing any gate, with reasons; keeps clean rows", () => {
    const { kept, dropped } = hardFilter([
      { ...base, name: "ok" },
      { ...base, name: "oob", inDistrict: false },
      { ...base, name: "noperm", propertyPermission: false },
      { ...base, name: "nobuf", bufferVerified: false, inDistrict: false }, // two reasons
    ]);
    expect(kept.map((r) => r.name)).toEqual(["ok"]);
    expect(dropped.find((d) => d.row.name === "oob")?.reasons).toEqual(["out-of-district"]);
    expect(dropped.find((d) => d.row.name === "nobuf")?.reasons).toEqual(["out-of-district", "buffer not verified"]);
  });
});

describe("normalizeTraffic", () => {
  it("min-max normalizes raw MoDOT counts across the set (raw 45k ≠ raw 3k)", () => {
    const [a, b, c] = normalizeTraffic([
      { ...base, name: "hwy", aadtRaw: 45000 },
      { ...base, name: "arterial", aadtRaw: 24000 },
      { ...base, name: "street", aadtRaw: 3000 },
    ]);
    expect(a.aadtNorm).toBe(1);
    expect(c.aadtNorm).toBe(0);
    expect(b.aadtNorm).toBeGreaterThan(0.4);
    expect(b.aadtNorm).toBeLessThan(0.6);
  });

  it("leaves an explicit aadt_norm untouched and maps a degenerate set to 1", () => {
    const [explicit, only] = normalizeTraffic([
      { ...base, name: "explicit", aadtNorm: 0.3, aadtRaw: 45000 },
      { ...base, name: "only", aadtRaw: 9000 },
    ]);
    expect(explicit.aadtNorm).toBe(0.3); // pre-normalized wins
    expect(only.aadtNorm).toBe(1); // single raw value → 1.0, not NaN
  });
});

describe("placementScore", () => {
  it("an early-vote site (14 days) outscores a same-quality Election-Day-only site (1 day)", () => {
    const early = placementScore({ ...base, type: "site", voterContactValue: 0.9, daysActive: 14, visibility: 0.9, serviceability: 1 });
    const eday = placementScore({ ...base, type: "site", voterContactValue: 0.9, daysActive: 1, visibility: 0.9, serviceability: 1 });
    expect(early).toBeGreaterThan(eday);
    expect(eday).toBeGreaterThan(0); // days is dominant but never a zero multiplier
  });

  it("corridor score multiplies traffic × propensity × visibility × serviceability", () => {
    expect(placementScore({ ...base, type: "corridor", aadtNorm: 1, propensity: 1, visibility: 1, serviceability: 1 })).toBe(1);
    // an un-hosted location floors serviceability at 0.5 (missing → 0.5), halving an otherwise-perfect score
    expect(placementScore({ ...base, type: "corridor", aadtNorm: 1, propensity: 1, visibility: 1 })).toBe(0.5);
  });

  it("missing traffic data defaults NEUTRAL (0.5), never zero — a spec-schema CSV still ranks", () => {
    // The plan's own polling_sites.csv carries no traffic columns; that must not zero every corridor.
    const noTraffic = placementScore({ ...base, type: "corridor", propensity: 1, visibility: 1, serviceability: 1 });
    expect(noTraffic).toBe(0.5); // neutral traffic, not 0
    const higherVis = placementScore({ ...base, type: "corridor", propensity: 1, visibility: 0.8, serviceability: 1 });
    expect(noTraffic).toBeGreaterThan(higherVis); // rows still differentiate on the factors that exist
  });

  it("clamps out-of-range factors", () => {
    expect(placementScore({ ...base, type: "corridor", aadtNorm: 5, propensity: 2, visibility: 9, serviceability: 9 })).toBe(1);
  });
});

describe("scorePlacements", () => {
  it("ranks per-family (site vs corridor/residential get independent rank 1)", () => {
    const scored = scorePlacements([
      { ...base, name: "siteHi", type: "site", voterContactValue: 0.9, daysActive: 14, visibility: 1, serviceability: 1 },
      { ...base, name: "siteLo", type: "site", voterContactValue: 0.3, daysActive: 1, visibility: 0.5, serviceability: 0.5 },
      { ...base, name: "corrHi", type: "corridor", aadtNorm: 1, propensity: 1, visibility: 1, serviceability: 1 },
      { ...base, name: "corrLo", type: "residential", aadtNorm: 0.2, propensity: 0.4, visibility: 0.5, serviceability: 0.5 },
    ]);
    expect(scored.find((s) => s.name === "siteHi")?.rank).toBe(1); // top of the site family
    expect(scored.find((s) => s.name === "corrHi")?.rank).toBe(1); // top of the corridor/residential family
    expect(scored.find((s) => s.name === "siteLo")?.rank).toBe(2);
    expect(scored.find((s) => s.name === "corrLo")?.rank).toBe(2);
  });

  it("tiers by rank-percentile within a family (top 40% → A, next 30% → B, rest → C)", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      ...base,
      name: `c${i}`,
      type: "corridor" as const,
      aadtNorm: 1 - i * 0.15, // strictly descending → deterministic ranks 1..5
      propensity: 1,
      visibility: 1,
      serviceability: 1,
    }));
    const scored = scorePlacements(rows).sort((a, b) => a.rank - b.rank);
    expect(scored.map((s) => s.tier)).toEqual(["A", "A", "B", "C", "C"]); // 20,40 → A; 60 → B; 80,100 → C
  });

  it("tie-breaks by serviceability then propensity", () => {
    const scored = scorePlacements([
      { ...base, name: "flashy", type: "corridor", aadtNorm: 0.8, propensity: 0.5, visibility: 1, serviceability: 0.5 },
      { ...base, name: "maintainable", type: "corridor", aadtNorm: 0.8, propensity: 0.5, visibility: 1, serviceability: 1 },
    ]);
    expect(scored[0].name).toBe("maintainable"); // higher serviceability wins even when it changes the score
    expect(scored.find((s) => s.name === "maintainable")!.rank).toBe(1);
  });
});

describe("allocateToCaptains", () => {
  const scored = scorePlacements([
    { ...base, name: "a", captainId: "C1", type: "corridor", aadtNorm: 1, propensity: 1, visibility: 1, serviceability: 1 },
    { ...base, name: "b", captainId: "C1", type: "corridor", aadtNorm: 0.9, propensity: 1, visibility: 1, serviceability: 1 },
    { ...base, name: "c", captainId: "C2", type: "corridor", aadtNorm: 0.8, propensity: 1, visibility: 1, serviceability: 1 },
    { ...base, name: "orphan", type: "corridor", aadtNorm: 0.7, propensity: 1, visibility: 1, serviceability: 1 }, // no captain
  ]);

  it("groups by captain, sorts packets by load, routes captain-less rows to needsHost", () => {
    const alloc = allocateToCaptains(scored, [{ id: "C1", name: "Cap One", signInventory: 10 }, { id: "C2" }]);
    expect(alloc.packets[0].captainId).toBe("C1"); // most loaded first
    expect(alloc.packets[0].count).toBe(2);
    expect(alloc.packets[0].placements.map((p) => p.name)).toEqual(["a", "b"]); // sorted by rank
    expect(alloc.needsHost.map((p) => p.name)).toEqual(["orphan"]);
    expect(alloc.totals).toEqual({ placed: 4, assigned: 3, needsHost: 1 });
  });

  it("flags overCapacity (> inventory) and overSpan (> spanMax)", () => {
    const alloc = allocateToCaptains(scored, [{ id: "C1", signInventory: 1 }, { id: "C2" }], { spanMax: 1 });
    const c1 = alloc.packets.find((p) => p.captainId === "C1")!;
    expect(c1.overCapacity).toBe(true); // 2 placements, inventory 1
    expect(c1.overSpan).toBe(true); // 2 placements, spanMax 1
    const c2 = alloc.packets.find((p) => p.captainId === "C2")!;
    expect(c2.overCapacity).toBe(false); // no inventory known → not flagged
  });

  it("treats an unknown captainId as needs-host (never invents a packet)", () => {
    const alloc = allocateToCaptains(
      [{ ...base, name: "z", captainId: "GHOST", type: "corridor", score: 0.5, rank: 1, tier: "A" }],
      [{ id: "C1" }],
    );
    expect(alloc.packets).toEqual([]);
    expect(alloc.needsHost.map((p) => p.name)).toEqual(["z"]);
  });
});

describe("distanceMeters", () => {
  it("is ~0 for the same point and positive across a known gap", () => {
    expect(distanceMeters({ lat: 38.6, lng: -90.5 }, { lat: 38.6, lng: -90.5 })).toBe(0);
    // ~1 deg of latitude ≈ 111 km
    const d = distanceMeters({ lat: 38.0, lng: -90.5 }, { lat: 39.0, lng: -90.5 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("CSV adapters", () => {
  it("rowToPlacement parses booleans/numbers, maps site_type, and keeps aadt RAW + notes/volunteer", () => {
    const p = rowToPlacement({
      name: "Daniel Boone Library",
      lat: "38.6031",
      lng: "-90.5673",
      site_type: "early_vote_and_eday",
      is_library: "true",
      in_district: "true",
      buffer_verified: "false",
      property_permission: "false",
      days_active: "14",
      captain_id: "C01",
      assigned_volunteer: "V001",
      aadt: "45000",
      notes: "confirm designation w/ STL Co BOE",
      precinct: "STL-042",
    });
    expect(p.type).toBe("site");
    expect(p.inDistrict).toBe(true);
    expect(p.bufferVerified).toBe(false);
    expect(p.daysActive).toBe(14);
    expect(p.lat).toBeCloseTo(38.6031);
    expect(p.aadtRaw).toBe(45000); // raw count — NOT clamped into 0..1
    expect(p.aadtNorm).toBeUndefined(); // normalized later, across the set
    expect(p.assignedVolunteer).toBe("V001");
    expect(p.notes).toContain("STL Co BOE"); // input notes survive the round trip
  });

  it("placementRows deploys sites FIRST (early-vote funded off the top), then corridors, sequential rank", () => {
    const scored = scorePlacements([
      { ...base, name: "bigCorridor", type: "corridor", aadtNorm: 1, propensity: 1, visibility: 1, serviceability: 1 }, // score 1.0
      { ...base, name: "modestSite", type: "site", voterContactValue: 0.6, daysActive: 14, visibility: 0.8, serviceability: 1 }, // score < 1.0
    ]);
    const rows = placementRows(scored);
    expect(PLACEMENT_OUTPUT_HEADERS[0]).toBe("rank");
    // The site deploys first even though the corridor's raw score is higher — the two families
    // score on different bases and §8.4 funds sites off the top.
    expect(rows[0][1]).toBe("modestSite");
    expect(rows[0][0]).toBe(1);
    expect(rows[1][1]).toBe("bigCorridor");
    expect(rows[1][0]).toBe(2);
  });

  it("appends DROPPED rows with reasons — the audit trail is in the download, not just a count", () => {
    const { kept, dropped } = hardFilter([
      { ...base, name: "good" },
      { ...base, name: "bad", inDistrict: false, notes: "was promising" },
    ]);
    const rows = placementRows(scorePlacements(kept), dropped);
    expect(rows.length).toBe(2);
    const droppedRow = rows[1];
    expect(droppedRow[0]).toBe(""); // no rank — not deployable
    expect(droppedRow[1]).toBe("bad");
    expect(String(droppedRow[11])).toContain("DROPPED: out-of-district");
    expect(String(droppedRow[11])).toContain("was promising"); // original notes preserved
  });

  it("neutralizes leading formula characters in name/notes (CSV injection)", () => {
    const scored = scorePlacements([
      { ...base, name: "=HYPERLINK(\"http://evil\")", type: "corridor", notes: "+SUM(A1)" },
    ]);
    const [row] = placementRows(scored);
    expect(String(row[1]).startsWith("'=")).toBe(true); // name defused
    expect(String(row[11]).startsWith("'+")).toBe(true); // notes defused
  });

  it("rowToCaptain maps the plan's captains.csv columns (inventory numeric, blanks undefined)", () => {
    expect(rowToCaptain({ id: "C01", name: "Maria Lopez", sign_inventory: "250" })).toEqual({
      id: "C01",
      name: "Maria Lopez",
      signInventory: 250,
    });
    expect(rowToCaptain({ id: " C02 ", name: "", sign_inventory: "" })).toEqual({
      id: "C02",
      name: undefined,
      signInventory: undefined,
    });
  });

  it("headers match the plan's placement_output schema (tier in place of the draft's phase)", () => {
    expect([...PLACEMENT_OUTPUT_HEADERS]).toEqual([
      "rank", "name", "lat", "lng", "type", "tier", "captain_id", "assigned_volunteer", "score", "precinct", "aadt", "notes",
    ]);
  });

  it("poiToPlacement maps a live polling-place feature safe-by-default (buffer/permission unverified)", () => {
    const feature: GeoJSON.Feature = {
      type: "Feature",
      properties: { name: "Daniel Boone Library", category: "polling", note: "300 Clarkson Rd, 63017" },
      geometry: { type: "Point", coordinates: [-90.5673, 38.6031] },
    };
    expect(poiToPlacement(feature)).toEqual({
      name: "Daniel Boone Library",
      lat: 38.6031,
      lng: -90.5673,
      type: "site",
      notes: "300 Clarkson Rd, 63017",
      inDistrict: true,
      bufferVerified: false,
      propertyPermission: false,
      daysActive: 1,
    });
  });

  it("poiToPlacement falls back to a generic name and drops geometry when not a Point", () => {
    const feature: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[[0, 0]]] },
    };
    const placement = poiToPlacement(feature);
    expect(placement.name).toBe("Polling place");
    expect(placement.lat).toBeUndefined();
    expect(placement.lng).toBeUndefined();
    expect(placement.bufferVerified).toBe(false);
    expect(placement.propertyPermission).toBe(false);
  });
});
