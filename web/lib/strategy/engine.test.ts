import { describe, it, expect } from "vitest";
import { normalize, safeHref, parseStrategy, buildCurated } from "./engine";
import { ISSUES } from "@/lib/issues";

describe("normalize", () => {
  it("falls back to the first issue and city level on junk input", () => {
    const n = normalize({ issueSlug: "nope", level: "galaxy", cadence: "??", depth: "??" });
    expect(n.issue.slug).toBe(ISSUES[0].slug);
    expect(n.level).toBe("city");
    expect(n.cadence).toBe("weekly");
    expect(n.depth).toBe("public");
  });

  it("accepts valid values and bounds area length", () => {
    const n = normalize({ issueSlug: "term-limits", level: "county", cadence: "daily", depth: "full", area: "x".repeat(200) });
    expect(n.issue.slug).toBe("term-limits");
    expect(n.level).toBe("county");
    expect(n.cadence).toBe("daily");
    expect(n.depth).toBe("full");
    expect(n.area.length).toBe(80);
  });

  it("defaults empty area to a safe placeholder", () => {
    expect(normalize({ area: "   " }).area).toBe("your area");
  });
});

describe("safeHref", () => {
  it("allows internal paths and the campaign origin, drops everything else", () => {
    expect(safeHref("/issues/term-limits")).toBe("/issues/term-limits");
    expect(safeHref("https://mattgrantforcongress.org/act")).toBe("https://mattgrantforcongress.org/act");
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("https://evil.example.com")).toBeUndefined();
    expect(safeHref("//evil.example.com")).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });
});

describe("parseStrategy", () => {
  const good = JSON.stringify({
    brief: ["A grounded paragraph.", "  ", "Second point."],
    actions: [
      { label: "Day 1", theme: "Learn", items: [{ text: "Read the argument", tag: "Learn", href: "javascript:bad" }] },
    ],
  });

  it("parses valid JSON, trims empty brief lines, and strips unsafe hrefs", () => {
    const out = parseStrategy(`here you go: ${good} thanks`);
    expect(out).not.toBeNull();
    expect(out!.brief).toEqual(["A grounded paragraph.", "Second point."]);
    expect(out!.actions[0].items[0].href).toBeUndefined();
    expect(out!.actions[0].items[0].text).toBe("Read the argument");
  });

  it("returns null when brief or actions are missing/empty", () => {
    expect(parseStrategy("not json")).toBeNull();
    expect(parseStrategy(JSON.stringify({ brief: [], actions: [] }))).toBeNull();
    expect(parseStrategy(JSON.stringify({ brief: ["x"], actions: [{ label: "D", items: [] }] }))).toBeNull();
  });
});

describe("buildCurated", () => {
  it("public teaser: one brief paragraph and at most 3 weekly days", () => {
    const r = buildCurated({ issueSlug: "family-courts", area: "Chesterfield", level: "city", cadence: "weekly", depth: "public" });
    expect(r.source).toBe("curated");
    expect(r.brief.length).toBe(1);
    expect(r.actions.length).toBeLessThanOrEqual(3);
    expect(r.disclaimer).toContain("Paid for by");
  });

  it("full depth: multi-paragraph brief mentioning the level", () => {
    const r = buildCurated({ issueSlug: "family-courts", area: "Jefferson County", level: "county", cadence: "weekly", depth: "full" });
    expect(r.brief.length).toBeGreaterThanOrEqual(2);
    expect(r.brief.join(" ")).toContain("county");
  });
});
