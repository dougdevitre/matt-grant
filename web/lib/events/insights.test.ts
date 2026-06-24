import { describe, it, expect } from "vitest";
import { parseInsight } from "./insights";

describe("parseInsight", () => {
  it("extracts a blurb array from a JSON response", () => {
    const out = parseInsight('Sure!\n{"blurb":["Sentence one.","Sentence two."]}\n');
    expect(out).toEqual(["Sentence one.", "Sentence two."]);
  });

  it("drops empties and clamps to 4 sentences", () => {
    const out = parseInsight(JSON.stringify({ blurb: ["a", "", "  ", "b", "c", "d", "e"] }));
    expect(out).toEqual(["a", "b", "c", "d"]);
  });

  it("returns null when there is no usable blurb", () => {
    expect(parseInsight(JSON.stringify({ blurb: [] }))).toBeNull();
    expect(parseInsight("no json here")).toBeNull();
  });

  it("truncates an over-long sentence", () => {
    const out = parseInsight(JSON.stringify({ blurb: ["x".repeat(500)] }))!;
    expect(out[0].length).toBe(280);
  });
});
