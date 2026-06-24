import { describe, it, expect } from "vitest";
import { planSync } from "./sync-pillars.mjs";

// planSync is the safety valve for the content sync: it decides whether a freshly
// imported pillar may overwrite the committed one, and which stale files to prune.
// The regression case is the important one — it prevents a transient clone failure
// or an upstream path-rename from silently wiping a live hub.
describe("planSync", () => {
  const doc = (file: string) => ({ slug: file.replace(/\.md$/, ""), file });
  const tool = (file: string) => ({ slug: file.replace(/\.html$/, ""), file });

  it("refuses to write when a populated pillar suddenly imports zero docs", () => {
    const prev = { docs: [doc("a.md"), doc("b.md"), doc("c.md")], tools: [] };
    const plan = planSync(prev, [], []);
    expect(plan).toEqual({ status: "regressed", write: false, orphans: [] });
  });

  it("treats an already-empty pillar staying empty as benign", () => {
    expect(planSync(null, [], [])).toEqual({ status: "empty", write: true, orphans: [] });
    expect(planSync({ docs: [], tools: [] }, [], [])).toEqual({ status: "empty", write: true, orphans: [] });
  });

  it("writes a first-ever sync with no orphans", () => {
    const plan = planSync(null, [doc("a.md")], [tool("x.html")]);
    expect(plan.status).toBe("ok");
    expect(plan.write).toBe(true);
    expect(plan.orphans).toEqual([]);
  });

  it("reports stale docs and tools as orphans to prune", () => {
    const prev = { docs: [doc("a.md"), doc("b.md")], tools: [tool("x.html"), tool("y.html")] };
    // b.md kept, a.md dropped; y.html kept, x.html dropped; c.md is new.
    const plan = planSync(prev, [doc("b.md"), doc("c.md")], [tool("y.html")]);
    expect(plan.status).toBe("ok");
    expect(plan.write).toBe(true);
    expect(plan.orphans.sort()).toEqual(["a.md", "x.html"]);
  });

  it("does not flag a tools-only pillar as regressed when it never had docs", () => {
    const plan = planSync({ docs: [], tools: [] }, [], [tool("x.html")]);
    expect(plan.status).toBe("ok");
    expect(plan.write).toBe(true);
  });
});
