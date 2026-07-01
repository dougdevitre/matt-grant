import { describe, it, expect } from "vitest";
import { toZip, selectFacts } from "./localSnapshot";
import type { ZctaAcs } from "@/lib/integrations/census/places";

const acs = (over: Partial<ZctaAcs> = {}): ZctaAcs => ({
  zcta: "63131",
  population: 30000,
  medianHouseholdIncome: 78000,
  medianAge: 42,
  medianHomeValue: 415000,
  bachelorsPlusPct: 55,
  sourceUrl: "https://data.census.gov/profile?g=860XX00US63131",
  ...over,
});

describe("toZip", () => {
  it("accepts a 5-digit zip", () => expect(toZip("63131")).toBe("63131"));
  it("takes the 5-digit prefix of ZIP+4", () => expect(toZip("63131-1234")).toBe("63131"));
  it("trims surrounding whitespace", () => expect(toZip("  63131 ")).toBe("63131"));
  it("rejects short / non-numeric / empty", () => {
    expect(toZip("1234")).toBeNull();
    expect(toZip("abcde")).toBeNull();
    expect(toZip("")).toBeNull();
    expect(toZip(undefined)).toBeNull();
    expect(toZip(null)).toBeNull();
  });
});

describe("selectFacts — per-issue allow-list (SPEC §4)", () => {
  it("lower-taxes → income + home value, both cited", () => {
    const facts = selectFacts("lower-taxes", acs());
    expect(facts.map((f) => f.key)).toEqual(["medianHouseholdIncome", "medianHomeValue"]);
    expect(facts[0].value).toBe("$78,000");
    expect(facts[1].value).toBe("$415,000");
    for (const f of facts) {
      expect(f.source).toMatch(/Census ACS/);
      expect(f.sourceUrl).toContain("census.gov");
    }
  });

  it("family-courts → population as civic context", () => {
    const facts = selectFacts("family-courts", acs());
    expect(facts.map((f) => f.key)).toEqual(["population"]);
    expect(facts[0].value).toBe("30,000");
  });

  it("smaller-government → population", () => {
    expect(selectFacts("smaller-government", acs()).map((f) => f.key)).toEqual(["population"]);
  });

  it("term-limits → NO local fact (federal reform, no honest hook)", () => {
    expect(selectFacts("term-limits", acs())).toEqual([]);
  });

  it("unknown issue → no facts", () => {
    expect(selectFacts("made-up", acs())).toEqual([]);
  });

  it("omits (never fakes) a figure the Census response left null", () => {
    const facts = selectFacts("lower-taxes", acs({ medianHomeValue: null }));
    expect(facts.map((f) => f.key)).toEqual(["medianHouseholdIncome"]);
  });

  it("every surfaced fact carries a citation", () => {
    for (const slug of ["family-courts", "lower-taxes", "smaller-government"]) {
      for (const f of selectFacts(slug, acs())) {
        expect(f.source.length).toBeGreaterThan(0);
        expect(f.sourceUrl).toMatch(/^https:\/\//);
      }
    }
  });
});
