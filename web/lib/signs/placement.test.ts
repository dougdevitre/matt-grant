import { describe, it, expect } from "vitest";
import {
  hardFilter,
  placementScore,
  scorePlacements,
  allocateToCaptains,
  distanceMeters,
  rowToPlacement,
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
    expect(dropped.find((d) => d.name === "oob")?.reasons).toEqual(["out-of-district"]);
    expect(dropped.find((d) => d.name === "nobuf")?.reasons).toEqual(["out-of-district", "buffer not verified"]);
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
  it("rowToPlacement parses booleans/numbers and maps site_type", () => {
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
      precinct: "STL-042",
    });
    expect(p.type).toBe("site");
    expect(p.inDistrict).toBe(true);
    expect(p.bufferVerified).toBe(false);
    expect(p.daysActive).toBe(14);
    expect(p.lat).toBeCloseTo(38.6031);
  });

  it("placementRows emits header-aligned, globally rank-ordered rows", () => {
    const scored = scorePlacements([
      { ...base, name: "lo", type: "corridor", aadtNorm: 0.2, propensity: 0.5, visibility: 0.5, serviceability: 0.5 },
      { ...base, name: "hi", type: "site", voterContactValue: 1, daysActive: 14, visibility: 1, serviceability: 1 },
    ]);
    const rows = placementRows(scored);
    expect(PLACEMENT_OUTPUT_HEADERS[0]).toBe("rank");
    expect(rows[0][0]).toBe(1); // rank 1
    expect(rows[0][1]).toBe("hi"); // highest score first, globally
    expect(rows.length).toBe(2);
  });
});
