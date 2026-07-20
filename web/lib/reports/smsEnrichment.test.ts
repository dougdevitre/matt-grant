import { describe, it, expect } from "vitest";
import { buildEnrichmentPlan, type MatchedVoterTag } from "./smsEnrichment";
import { ZIP_TO_COUNTY, matchCountyName } from "@/lib/sms/geo";

const countyKeyForName = (raw: string) => matchCountyName(raw)?.key ?? null;
const countyKeyForZip = (z: string) => ZIP_TO_COUNTY[z] ?? null;

const matchedVoter = (over: Partial<MatchedVoterTag> = {}): MatchedVoterTag => ({
  phone: "+13145550100",
  segment: "MOBILIZE",
  t: 4,
  county: "St. Louis",
  zip: "63011",
  banked: false,
  ...over,
});

const base = () => ({
  optedIn: new Set(["+13145550100", "+13145550101", "+13145550102"]),
  matched: [] as MatchedVoterTag[],
  contacts: [] as { phone: string; zip?: string | null }[],
  existingGeoSource: new Map<string, string>(),
  countyKeyForName,
  countyKeyForZip,
});

describe("buildEnrichmentPlan", () => {
  it("tags a voter-matched opted-in number with segment/T/banked + normalized geography", () => {
    const plan = buildEnrichmentPlan({ ...base(), matched: [matchedVoter()] });
    expect(plan.writes).toEqual([
      {
        phone: "+13145550100",
        voterSegment: "MOBILIZE",
        voterT: 4,
        banked: false,
        county: "st-louis", // raw "St. Louis" normalized to the CountyKey
        zip: "63011",
        geoSource: "voterfile",
      },
    ]);
  });

  it("never tags a number that isn't opted in — the wall stays one-directional", () => {
    const plan = buildEnrichmentPlan({
      ...base(),
      optedIn: new Set<string>(),
      matched: [matchedVoter()],
      contacts: [{ phone: "+13145550101", zip: "63084" }],
    });
    expect(plan.writes).toEqual([]);
    expect(plan.skippedNotOptedIn).toBe(2);
  });

  it("preserves self-reported geography (vote agent beats the voter file) but still tags scores", () => {
    const plan = buildEnrichmentPlan({
      ...base(),
      matched: [matchedVoter()],
      existingGeoSource: new Map([["+13145550100", "self"]]),
    });
    expect(plan.writes).toEqual([{ phone: "+13145550100", voterSegment: "MOBILIZE", voterT: 4, banked: false }]);
    expect(plan.geoPreserved).toBe(1);
  });

  it("contact-only ZIP fills geography; county only from the verified starter map", () => {
    const plan = buildEnrichmentPlan({
      ...base(),
      contacts: [
        { phone: "+13145550101", zip: "63084" }, // Union → franklin (in the map)
        { phone: "+13145550102", zip: "63090" }, // not in the starter map → zip only
      ],
    });
    expect(plan.writes).toEqual([
      { phone: "+13145550101", zip: "63084", county: "franklin", geoSource: "contact" },
      { phone: "+13145550102", zip: "63090", geoSource: "contact" },
    ]);
  });

  it("a voter-file match outranks a contact-only row for the same phone", () => {
    const plan = buildEnrichmentPlan({
      ...base(),
      matched: [matchedVoter({ county: "Franklin", zip: "63084" })],
      contacts: [{ phone: "+13145550100", zip: "63090" }],
    });
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]).toMatchObject({ county: "franklin", zip: "63084", geoSource: "voterfile" });
  });

  it("drops an unrecognized county name and a malformed zip rather than guessing", () => {
    const plan = buildEnrichmentPlan({ ...base(), matched: [matchedVoter({ county: "St. Charles", zip: "631" })] });
    expect(plan.writes[0]).toEqual({ phone: "+13145550100", voterSegment: "MOBILIZE", voterT: 4, banked: false });
  });

  it("carries banked=true through for GOTV chase suppression", () => {
    const plan = buildEnrichmentPlan({ ...base(), matched: [matchedVoter({ banked: true })] });
    expect(plan.writes[0].banked).toBe(true);
  });

  describe("school district (derived from ZIP, unambiguous only)", () => {
    // The injected resolver mirrors districtForZipUnambiguous: 63011 is certain,
    // 63084 crosses district lines (→ null), everything else unknown.
    const districtForZip = (z: string) => (z === "63011" ? "2900001" : null);

    it("attaches the district to a write that carries a resolvable ZIP", () => {
      const plan = buildEnrichmentPlan({ ...base(), matched: [matchedVoter()], districtForZip });
      expect(plan.writes[0].schoolDistrict).toBe("2900001");
    });

    it("never tags an ambiguous/unknown ZIP with a district", () => {
      const plan = buildEnrichmentPlan({ ...base(), matched: [matchedVoter({ zip: "63084" })], districtForZip });
      expect(plan.writes[0].schoolDistrict).toBeUndefined();
    });

    it("derives the district from a stored (e.g. self-reported) ZIP when this run adds no geo", () => {
      const plan = buildEnrichmentPlan({
        ...base(),
        matched: [matchedVoter()],
        existingGeoSource: new Map([["+13145550100", "self"]]), // geo preserved, no zip in the write
        existingZips: new Map([
          ["+13145550100", "63011"], // the self-reported zip still yields a district
          ["+13145550101", "63011"], // a row with ONLY a stored zip gets a district-only write
          ["+13145550102", "63084"], // ambiguous → no write at all
        ]),
        districtForZip,
      });
      const by = new Map(plan.writes.map((w) => [w.phone, w]));
      expect(by.get("+13145550100")).toMatchObject({ schoolDistrict: "2900001" });
      expect(by.get("+13145550100")?.zip).toBeUndefined(); // self geo still preserved
      expect(by.get("+13145550101")).toEqual({ phone: "+13145550101", schoolDistrict: "2900001" });
      expect(by.has("+13145550102")).toBe(false);
    });
  });
});
