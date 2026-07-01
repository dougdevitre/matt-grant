import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { checkLocalResponse, type GuardCtx } from "./localResponseGuards";
import { getIssue } from "@/lib/issues";

// The Phase-0 contract's golden fixtures ARE the gate — load them and assert the
// guards accept every allowed output and reject every forbidden one (SPEC §8).
const fixtures = JSON.parse(
  readFileSync(new URL("../../docs/local-intersection/golden-fixtures.json", import.meta.url), "utf8"),
) as {
  fixtures: Array<{
    id: string;
    input: { issueSlug: string };
    snapshot: { place: string; figures: Record<string, string>; citations?: string[] } | null;
    allowed_example?: { brief: string[]; actions: { items: { text: string }[] }[] };
    forbidden_examples?: { text: string; violates: string[] }[];
  }>;
};

const ctxFor = (slug: string, snapshot: GuardCtx["snapshot"]): GuardCtx => {
  const issue = getIssue(slug);
  const documentedText = [issue?.commitment, issue?.argument, issue?.signature?.body].filter(Boolean).join(" ");
  return { snapshot, documentedText };
};

const flatten = (ex: { brief: string[]; actions: { items: { text: string }[] }[] }): string =>
  [...ex.brief, ...ex.actions.flatMap((d) => d.items.map((i) => i.text))].join("\n");

describe("localResponseGuards — golden fixtures (SPEC §8)", () => {
  for (const fx of fixtures.fixtures) {
    if (fx.allowed_example) {
      it(`ACCEPTS the allowed output for ${fx.id}`, () => {
        const res = checkLocalResponse(flatten(fx.allowed_example!), ctxFor(fx.input.issueSlug, fx.snapshot));
        expect(res.violations, res.detail.join("; ")).toEqual([]);
        expect(res.ok).toBe(true);
      });
    }
    for (const [i, bad] of (fx.forbidden_examples ?? []).entries()) {
      it(`REJECTS forbidden #${i + 1} for ${fx.id} (${bad.violates.join(",")})`, () => {
        const res = checkLocalResponse(bad.text, ctxFor(fx.input.issueSlug, fx.snapshot));
        expect(res.ok).toBe(false);
      });
    }
  }
});

describe("localResponseGuards — unit", () => {
  const ctx = ctxFor("lower-taxes", { place: "Jefferson County", figures: { medianHouseholdIncome: "$72000" }, citations: ["U.S. Census ACS 5-yr 2023"] });

  it("passes a clean, sourced sentence", () => {
    expect(checkLocalResponse("In Jefferson County the median household income is about $72000 (ACS 2023).", ctx).ok).toBe(true);
  });
  it("flags an invented figure", () => {
    expect(checkLocalResponse("About 31% of households include children.", ctx).violations).toContain("invented-figure");
  });
  it("flags a named local official", () => {
    expect(checkLocalResponse("Judge Smith mishandled the case.", ctx).violations).toContain("foreign-locality");
  });
  it("flags an undocumented local position", () => {
    expect(checkLocalResponse("Matt opposes the district budget.", ctx).violations).toContain("undocumented-position");
  });
  it("does NOT flag a documented position with no local object", () => {
    expect(checkLocalResponse("Matt's commitment is to support term limits for the House and Senate.", ctx).ok).toBe(true);
  });
});
