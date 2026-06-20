import { describe, it, expect } from "vitest";
import { headlineMatches } from "@/lib/integrations/news/client";

// Keeps low-profile candidates from getting the wrong person's news (Google News
// RSS phrase matching is loose).
describe("headlineMatches", () => {
  it("keeps a headline that names the candidate", () => {
    expect(headlineMatches("Ann Wagner", "Congresswoman Ann Wagner Votes in Support of the Secure America Act")).toBe(true);
    expect(headlineMatches("Fred Wellman", "In conversation with Fred Wellman")).toBe(true);
  });

  it("drops a same-surname-but-wrong-person headline", () => {
    expect(headlineMatches("Chuck Summers", "Jo-An Summers Obituary (2026) - Raymore, MO")).toBe(false);
  });

  it("drops an unrelated headline that merely matched the loose query", () => {
    expect(headlineMatches("Nick Vivio", "Trump on Iran: 'Entire country could be taken out'")).toBe(false);
    expect(headlineMatches("Joan VonDras", "Politics: Statewide amendment battles begin")).toBe(false);
  });

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(headlineMatches("  ann wagner  ", "ANN WAGNER wins endorsement")).toBe(true);
  });
});
