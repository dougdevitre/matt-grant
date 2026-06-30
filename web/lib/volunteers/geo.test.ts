import { describe, it, expect } from "vitest";
import { buildGeoIndex, resolveRegion, coverageNamesFor } from "./geo";
import type { Region } from "./regions";

// A small hierarchy: County → City, with one city carrying ZIPs.
const regions: Region[] = [
  { id: "recCounty", name: "St. Louis County", level: "County", parent: null },
  { id: "recCity", name: "Kirkwood", level: "City", parent: "recCounty", zips: ["63122"] },
  { id: "recCity2", name: "Webster Groves", level: "City", parent: "St. Louis County" }, // parent by NAME
  { id: "recOther", name: "St. Charles County", level: "County", parent: null },
];
const idx = buildGeoIndex(regions);

describe("resolveRegion", () => {
  it("resolves by ZIP first (most precise)", () => {
    expect(resolveRegion({ zip: "63122", city: "Nowhere" }, idx)?.name).toBe("Kirkwood");
  });
  it("falls back to city name (case-insensitive)", () => {
    expect(resolveRegion({ city: "kirkwood" }, idx)?.name).toBe("Kirkwood");
  });
  it("returns undefined when it can't place the volunteer", () => {
    expect(resolveRegion({ zip: "99999", city: "Atlantis" }, idx)).toBeUndefined();
  });
});

describe("coverageNamesFor", () => {
  it("includes the city AND its ancestor county (the precision win)", () => {
    const cover = coverageNamesFor({ city: "Kirkwood" }, idx);
    expect(cover.has("kirkwood")).toBe(true);
    expect(cover.has("st. louis county")).toBe(true);
  });
  it("walks a parent given by name, not just record id", () => {
    const cover = coverageNamesFor({ city: "Webster Groves" }, idx);
    expect(cover.has("st. louis county")).toBe(true);
  });
  it("resolves the chain from a ZIP", () => {
    const cover = coverageNamesFor({ zip: "63122" }, idx);
    expect([...cover].sort()).toEqual(["kirkwood", "st. louis county"]);
  });
  it("is empty when the volunteer can't be placed", () => {
    expect(coverageNamesFor({ city: "Atlantis" }, idx).size).toBe(0);
  });
  it("is cycle-safe if the data has a parent loop", () => {
    const loop: Region[] = [
      { id: "a", name: "A", level: "x", parent: "b" },
      { id: "b", name: "B", level: "x", parent: "a" },
    ];
    const cover = coverageNamesFor({ city: "A" }, buildGeoIndex(loop));
    expect([...cover].sort()).toEqual(["a", "b"]); // both once, no hang
  });
});
