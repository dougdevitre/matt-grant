import { describe, it, expect } from "vitest";
import { looksLikeCandidate } from "@/lib/integrations/wikipedia/client";

// The guard that stops an oppo-research tool from showing the WRONG person's
// Wikipedia article on a candidate profile (e.g. a different "Ann Wagner").
describe("looksLikeCandidate", () => {
  it("accepts a real politician whose surname matches", () => {
    expect(
      looksLikeCandidate(
        "Ann Wagner",
        "Ann Wagner",
        "American politician (born 1962)",
        "Ann Louise Wagner is an American politician serving as the U.S. representative for Missouri's 2nd congressional district. A member of the Republican Party…",
      ),
    ).toBe(true);
  });

  it("rejects a same-name NON-politician (the core risk)", () => {
    expect(
      looksLikeCandidate("Ann Wagner", "Ann Wagner", "German rower", "Ann Wagner is a German rower who competed at the 1976 Summer Olympics."),
    ).toBe(false);
  });

  it("rejects when the surname is absent (resolved to the wrong article)", () => {
    expect(
      looksLikeCandidate("Jane Doe", "John Smith", "American politician", "John Smith is a United States senator from Ohio."),
    ).toBe(false);
  });

  it("is case-insensitive on both the politics signal and the surname", () => {
    expect(looksLikeCandidate("Tim BILASH", "Tim Bilash", null, "Tim Bilash is a CANDIDATE for U.S. House in Missouri.")).toBe(true);
  });

  it("requires a meaningful surname (ignores 1–2 char tokens)", () => {
    expect(looksLikeCandidate("Bob X", "Politician X", "American politician", "X is a senator.")).toBe(false);
  });

  it("rejects when neither condition holds", () => {
    expect(looksLikeCandidate("Foo Bar", "Foo Bar", "British footballer", "Foo Bar plays association football.")).toBe(false);
  });
});
