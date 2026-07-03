import { describe, it, expect } from "vitest";
import { loadCsvManifest } from "@/lib/data/csv";
import {
  loadChildUnder15ByCounty,
  loadUnder5DeclineByMetro,
  loadStCharlesAgeStructure,
  loadMsaPopulationByAge,
  loadAgingIndexByMetro,
  mo02Counties,
  MO02_COUNTY_NAMES,
  CountyUnder15,
} from "./schema";

// Provenance guard: the committed manifests must match the figures published in the
// Sándoval/SLU analysis. If a re-ingest drifts from these, a public page would show
// a wrong number — fail here instead. Values below are quoted from that analysis.

function data<T>(r: { ok: boolean; data: T | null }): T {
  expect(r.ok).toBe(true);
  return r.data as T;
}

describe("child under-15 by county", () => {
  const rows = () => data(loadChildUnder15ByCounty());

  it("validates and cross-checks the published MSA + Jefferson figures", () => {
    const by = (n: string) => rows().find((r) => r.county === n)!;
    expect(by("Saint Louis MSA").under15_2025).toBe(481589); // email: 481,589 under-15 in 2025
    expect(by("Saint Louis MSA").under15_2020).toBe(515347);
    expect(by("Saint Louis MSA").change).toBe(-33758); // −33,758 since 2020
    expect(by("Jefferson County").under15_2025).toBe(40755);
    expect(by("Jefferson County").change).toBe(-2396); // "lost 2,396 children under age 15"
  });

  it("exposes only the in-data MO-02 counties (St. Louis Co. + Jefferson), in fixed order", () => {
    // MO02_COUNTY_NAMES is the true 2025-map district (5 counties); this MSA dataset
    // only contains St. Louis County and Jefferson County, so mo02Counties() returns
    // those two, ordered as they appear in MO02_COUNTY_NAMES. The rural three
    // (Washington/Crawford/Gasconade) are absent from the source.
    const mo = mo02Counties(rows());
    expect(mo.map((r) => r.county)).toEqual(["St. Louis County", "Jefferson County"]);
    for (const r of mo) expect(r.under15_2025).toBeGreaterThan(0);
    // Guard the canonical district list itself so it can't silently regress to the
    // wrong (MO-03) counties.
    expect(MO02_COUNTY_NAMES).toContain("Washington County");
    expect(MO02_COUNTY_NAMES).not.toContain("St. Charles County");
  });

  // Tripwire: the source lists "Madison County" twice (IL + an unlabeled second row,
  // see candidate/data/SOURCES.md). If the source is de-duplicated/relabeled later,
  // this fails so we re-verify the citation rather than silently shipping a change.
  it("still contains the two documented, unresolved 'Madison County' rows", () => {
    expect(rows().filter((r) => r.county === "Madison County")).toHaveLength(2);
  });

  // A ragged/blank numeric cell must FAIL validation, not coerce to 0 (which would
  // render fake zeros on a public figure). Guards the fail-loud contract.
  it("rejects a blank numeric cell instead of coercing it to 0", () => {
    const manifest = {
      generatedFrom: "test",
      columns: ["county", "under15_2020", "under15_2025", "change", "pctChange"],
      items: [{ county: "X", under15_2020: "", under15_2025: "100", change: "-1", pctChange: "-1.0" }],
    };
    expect(loadCsvManifest(manifest, CountyUnder15, { source: "test" }).ok).toBe(false);
  });
});

describe("under-5 decline by metro", () => {
  it("ranks St. Louis 3rd-worst by percent decline", () => {
    const rows = data(loadUnder5DeclineByMetro());
    const worst3 = [...rows].sort((a, b) => a.pctDecline - b.pctDecline).slice(0, 3);
    expect(worst3[2].metro).toContain("St. Louis"); // "third in the percentage decline"
  });
});

describe("St. Charles age structure", () => {
  it("cross-checks the +21,233 total growth", () => {
    const total = data(loadStCharlesAgeStructure()).find((r) => r.ageGroup === "Total")!;
    expect(total.change).toBe(21233); // "grown by 21,233 residents since 2020"
  });
});

describe("MSA population by age + aging index", () => {
  it("loads and validates", () => {
    expect(data(loadMsaPopulationByAge()).find((r) => r.ageGroup === "Age 0-4")!.y2025).toBe(144940);
    const stl = data(loadAgingIndexByMetro()).find((r) => r.metro.includes("St. Louis"))!;
    expect(stl.pct65plus2025).toBeGreaterThan(19); // "share age 65+ … 20.1%"
  });
});
