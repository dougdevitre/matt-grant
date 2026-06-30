import { describe, it, expect } from "vitest";
import { buildPlaybook, CAPTAIN_PLAYS, CADENCE_ORDER, type Play } from "./playbook";
import type { Region } from "./regions";

const region = (name: string): Region => ({ name, level: "County", parent: null });

describe("CAPTAIN_PLAYS catalog", () => {
  it("every play maps to a real dashboard route and has a how/where", () => {
    for (const p of CAPTAIN_PLAYS) {
      expect(p.href.startsWith("/dashboard/")).toBe(true);
      expect(p.how.length).toBeGreaterThan(0);
      expect(p.where.length).toBeGreaterThan(0);
      expect(CADENCE_ORDER).toContain(p.cadence);
    }
  });
  it("has unique ids", () => {
    const ids = CAPTAIN_PLAYS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildPlaybook", () => {
  it("returns team plays once and region plays per assigned region", () => {
    const pb = buildPlaybook([region("St. Louis County"), region("Jefferson County")]);
    expect(pb.hasRegions).toBe(true);
    expect(pb.byRegion).toHaveLength(2);
    expect(pb.byRegion[0].region.name).toBe("St. Louis County");
    // team + region plays partition the catalog
    expect(pb.team.length + pb.regionPlays.length).toBe(CAPTAIN_PLAYS.length);
    expect(pb.team.every((p) => p.scope === "team")).toBe(true);
    expect(pb.byRegion[0].plays.every((p) => p.scope === "region")).toBe(true);
  });

  it("with no regions still returns team plays and the region-play template", () => {
    const pb = buildPlaybook([]);
    expect(pb.hasRegions).toBe(false);
    expect(pb.byRegion).toHaveLength(0);
    expect(pb.team.length).toBeGreaterThan(0);
    expect(pb.regionPlays.length).toBeGreaterThan(0);
  });

  it("sorts plays by cadence (weekly first) then title", () => {
    const plays: Play[] = [
      { id: "b", title: "B monthly", cadence: "monthly", mode: "both", scope: "team", how: "x", where: "w", href: "/dashboard/x" },
      { id: "a", title: "A weekly", cadence: "weekly", mode: "both", scope: "team", how: "x", where: "w", href: "/dashboard/x" },
      { id: "c", title: "C weekly", cadence: "weekly", mode: "both", scope: "team", how: "x", where: "w", href: "/dashboard/x" },
    ];
    const pb = buildPlaybook([], plays);
    expect(pb.team.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("is deterministic (same input → same output order)", () => {
    const r = [region("A"), region("B")];
    expect(JSON.stringify(buildPlaybook(r))).toBe(JSON.stringify(buildPlaybook(r)));
  });
});
