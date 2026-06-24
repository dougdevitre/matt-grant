import { describe, it, expect } from "vitest";
import { trimHeadline } from "./headline";

describe("trimHeadline", () => {
  it("returns short text unchanged (no ellipsis)", () => {
    expect(trimHeadline("Put Missouri's children first.", 70)).toBe("Put Missouri's children first.");
  });

  it("collapses internal whitespace", () => {
    expect(trimHeadline("Lower   taxes\n  now", 70)).toBe("Lower taxes now");
  });

  it("trims to a word boundary (never mid-word) and adds an ellipsis", () => {
    const src = "Want lower taxes? Cut the fraud, waste, and bloated headcount first. You don't get there by raising them.";
    const out = trimHeadline(src, 70);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(71); // <= max + the ellipsis char
    // No mid-word cut + unaltered text: everything before the ellipsis (minus any
    // stripped trailing punctuation) is a verbatim substring of the source.
    expect(src).toContain(out.slice(0, -1));
    expect(out).toContain("bloated");
  });

  it("strips trailing punctuation before the ellipsis", () => {
    const out = trimHeadline("Cut the fraud, waste, and bloated headcount first, immediately and aggressively now", 40);
    expect(out).not.toMatch(/[,;:.!?\s-]…$/);
  });

  it("falls back to a hard cut for a single very long word", () => {
    const out = trimHeadline("a".repeat(120), 70);
    expect(out).toBe("a".repeat(70) + "…");
  });
});
