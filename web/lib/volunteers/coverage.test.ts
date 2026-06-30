import { describe, it, expect } from "vitest";
import { buildCoverage, SPAN_MAX } from "./coverage";
import type { Region } from "./regions";
import type { Captain } from "./captains";

const region = (name: string, level = "County", parent: string | null = null): Region => ({ name, level, parent });
const cap = (email: string, regions: string[] | undefined, teamSize = 0): Captain => ({
  email,
  firstName: email.split("@")[0],
  regions,
  teamSize,
});

describe("buildCoverage", () => {
  const regions = [region("St. Louis County"), region("St. Charles County"), region("Jefferson County")];

  it("flags a region with no captain as a gap", () => {
    const rep = buildCoverage(regions, [cap("a@x.com", ["St. Louis County"], 3)]);
    const stl = rep.rows.find((r) => r.region.name === "St. Louis County")!;
    const jeff = rep.rows.find((r) => r.region.name === "Jefferson County")!;
    expect(stl.gap).toBe(false);
    expect(jeff.gap).toBe(true);
    expect(rep.totals.gaps).toBe(2); // St. Charles + Jefferson
    expect(rep.totals.covered).toBe(1);
  });

  it("flags more than one captain in a region as overlap", () => {
    const rep = buildCoverage(regions, [
      cap("a@x.com", ["St. Louis County"], 2),
      cap("b@x.com", ["St. Louis County"], 1),
    ]);
    const stl = rep.rows.find((r) => r.region.name === "St. Louis County")!;
    expect(stl.overlap).toBe(true);
    expect(stl.captainCount).toBe(2);
    expect(stl.teamSize).toBe(3); // combined
    expect(rep.totals.overlaps).toBe(1);
  });

  it("flags over-span when combined team reaches the max", () => {
    const rep = buildCoverage(regions, [cap("a@x.com", ["St. Charles County"], SPAN_MAX)]);
    const sc = rep.rows.find((r) => r.region.name === "St. Charles County")!;
    expect(sc.overSpan).toBe(true);
    const rep2 = buildCoverage(regions, [cap("a@x.com", ["St. Charles County"], SPAN_MAX - 1)]);
    expect(rep2.rows.find((r) => r.region.name === "St. Charles County")!.overSpan).toBe(false);
  });

  it("matches region names case-insensitively", () => {
    const rep = buildCoverage(regions, [cap("a@x.com", ["st. louis county"], 1)]);
    expect(rep.rows.find((r) => r.region.name === "St. Louis County")!.gap).toBe(false);
  });

  it("surfaces captains with no region as unassigned", () => {
    const rep = buildCoverage(regions, [cap("a@x.com", undefined, 4), cap("b@x.com", [], 2)]);
    expect(rep.unassigned.map((c) => c.email)).toEqual(["a@x.com", "b@x.com"]);
    expect(rep.totals.unassignedCaptains).toBe(2);
  });

  it("surfaces a region not in the hierarchy as unknown", () => {
    const rep = buildCoverage(regions, [cap("a@x.com", ["Atlantis"], 1)]);
    expect(rep.unknownRegions).toHaveLength(1);
    expect(rep.unknownRegions[0].region.name).toBe("Atlantis");
  });

  it("counts a captain covering multiple regions in each", () => {
    const rep = buildCoverage(regions, [cap("a@x.com", ["St. Louis County", "Jefferson County"], 5)]);
    expect(rep.rows.find((r) => r.region.name === "St. Louis County")!.gap).toBe(false);
    expect(rep.rows.find((r) => r.region.name === "Jefferson County")!.gap).toBe(false);
    expect(rep.totals.gaps).toBe(1); // only St. Charles
  });

  it("sorts captains within a region by team size desc then email", () => {
    const rep = buildCoverage([region("St. Louis County")], [
      cap("z@x.com", ["St. Louis County"], 1),
      cap("a@x.com", ["St. Louis County"], 5),
      cap("m@x.com", ["St. Louis County"], 5),
    ]);
    expect(rep.rows[0].captains.map((c) => c.email)).toEqual(["a@x.com", "m@x.com", "z@x.com"]);
  });
});
