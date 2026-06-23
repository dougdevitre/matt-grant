import { describe, it, expect } from "vitest";
import { emailSet, isIn } from "@/lib/engagement";

describe("emailSet", () => {
  it("lowercases, trims, de-duplicates, and skips blank/null emails", () => {
    const set = emailSet([
      { email: "A@B.co" },
      { email: " a@b.co " },
      { email: null },
      { email: "" },
      { email: "c@d.co" },
    ]);
    expect([...set].sort()).toEqual(["a@b.co", "c@d.co"]);
  });
});

describe("isIn", () => {
  const set = emailSet([{ email: "Donor@Example.com" }]);
  it("matches case-insensitively", () => {
    expect(isIn(set, "donor@example.com")).toBe(true);
    expect(isIn(set, "  DONOR@EXAMPLE.COM ")).toBe(true);
  });
  it("is false for a blank or absent email", () => {
    expect(isIn(set, null)).toBe(false);
    expect(isIn(set, "")).toBe(false);
    expect(isIn(set, "someone@else.co")).toBe(false);
  });
});
