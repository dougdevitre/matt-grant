import { describe, expect, it } from "vitest";
import { planResume, reconcileCounts, reconcileStale, runCoveringAll, type PriorRun } from "./ingestPlan";

const run = (SK: string, hashes: string[], voters?: number): PriorRun => ({
  SK,
  files: hashes.map((sha256, i) => ({ file: `Part${i + 1}`, sha256, rows: 100 })),
  ...(voters != null ? { voters } : {}),
});

const files = (hashes: string[]) => hashes.map((sha256, i) => ({ file: `Part${i + 1}`, sha256 }));

describe("runCoveringAll", () => {
  it("finds a prior run whose hashes cover every current file", () => {
    const priors = [run("2026-07-10T00:00:00Z", ["a", "b", "c"])];
    expect(runCoveringAll(priors, files(["a", "b", "c"]))?.SK).toBe("2026-07-10T00:00:00Z");
  });

  it("returns null when any file hash changed", () => {
    const priors = [run("2026-07-10T00:00:00Z", ["a", "b", "c"])];
    expect(runCoveringAll(priors, files(["a", "b", "CHANGED"]))).toBeNull();
  });

  it("returns null when there are no prior runs or no files", () => {
    expect(runCoveringAll([], files(["a"]))).toBeNull();
    expect(runCoveringAll([run("x", ["a"])], [])).toBeNull();
  });

  it("prefers the newest covering run", () => {
    const priors = [run("2026-07-09T00:00:00Z", ["a"]), run("2026-07-11T00:00:00Z", ["a"])];
    expect(runCoveringAll(priors, files(["a"]))?.SK).toBe("2026-07-11T00:00:00Z");
  });
});

describe("planResume", () => {
  it("skips when a prior run covers all files", () => {
    const d = planResume([run("t1", ["a", "b"])], files(["a", "b"]));
    expect(d.skip).toBe(true);
    expect(d.coveredBy?.SK).toBe("t1");
  });

  it("does not skip when a file changed", () => {
    expect(planResume([run("t1", ["a", "b"])], files(["a", "z"])).skip).toBe(false);
  });

  it("never skips under --force", () => {
    expect(planResume([run("t1", ["a", "b"])], files(["a", "b"]), true).skip).toBe(false);
  });
});

describe("reconcileCounts", () => {
  it("reports the net delta vs the newest prior run", () => {
    const priors = [run("2026-07-09T00:00:00Z", ["a"], 500_000), run("2026-07-11T00:00:00Z", ["a"], 577_000)];
    expect(reconcileCounts(priors, 577_366)).toEqual({ previous: 577_000, current: 577_366, delta: 366 });
  });

  it("has a null delta with no prior run", () => {
    expect(reconcileCounts([], 100)).toEqual({ previous: null, current: 100, delta: null });
  });
});

describe("reconcileStale", () => {
  it("lists IDs present before but absent now", () => {
    expect(reconcileStale(["v1", "v2", "v3"], new Set(["v1", "v3"]))).toEqual(["v2"]);
  });

  it("returns empty when nothing departed", () => {
    expect(reconcileStale(["v1"], new Set(["v1", "v2"]))).toEqual([]);
  });
});
