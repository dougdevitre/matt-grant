import { describe, it, expect } from "vitest";
import { PILLARS, publicPillars, publicPillarSlugs, pillarSlugs, getPillar } from "./pillars";

// The `hidden` flag keeps a pillar in the catalog (so the sync still tracks its
// repo) while removing it from every public surface and 404-ing its hub. These
// assertions lock that contract so a hub with no real content (food, justice) — or
// off-mission content unfit for the candidate's domain (health) — can't leak live.
describe("pillar visibility (hidden flag)", () => {
  const HIDDEN = ["food", "justice", "health"];

  it("marks food, justice, and health hidden", () => {
    for (const slug of HIDDEN) expect(getPillar(slug)?.hidden, slug).toBe(true);
  });

  it("excludes hidden pillars from the public subset", () => {
    for (const slug of HIDDEN) {
      expect(publicPillarSlugs).not.toContain(slug);
      expect(publicPillars.some((p) => p.slug === slug)).toBe(false);
    }
    expect(publicPillars.length).toBe(PILLARS.length - HIDDEN.length);
    expect(publicPillars.every((p) => !p.hidden)).toBe(true);
  });

  it("still recognizes hidden slugs in the full catalog (sync + routing)", () => {
    // pillarSlugs stays all-inclusive so the host router treats a hidden subdomain
    // as known (404s its path) rather than logging it as an unknown subdomain.
    for (const slug of HIDDEN) {
      expect(pillarSlugs).toContain(slug);
      expect(getPillar(slug)).toBeTruthy();
    }
  });
});
