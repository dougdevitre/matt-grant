import { describe, it, expect } from "vitest";
import { previewOf, summarize, remedyFor, type HubKind } from "@/lib/data/hubStatus";
import type { SourceEntry } from "@/lib/data/registry";

describe("previewOf", () => {
  it("pulls feature names from a FeatureCollection", () => {
    const fc = {
      type: "FeatureCollection",
      features: [
        { properties: { name: "Kirkwood" } },
        { properties: { name: "Ballwin" } },
        { properties: {} },
      ],
    };
    expect(previewOf(fc)).toEqual(["Kirkwood", "Ballwin", "feature 3"]);
  });

  it("labels array items by item/name", () => {
    expect(previewOf([{ item: "Donor letter" }, { name: "Flyer" }, "raw"])).toEqual([
      "Donor letter",
      "Flyer",
      "raw",
    ]);
  });

  it("digs into a wrapped object's first array field", () => {
    expect(previewOf({ generatedAt: "x", bills: [{ title: "HR 1" }, { title: "HR 2" }] })).toEqual(["HR 1", "HR 2"]);
  });

  it("returns [] for empty/nullish", () => {
    expect(previewOf(null)).toEqual([]);
    expect(previewOf([])).toEqual([]);
  });

  it("respects the limit", () => {
    expect(previewOf([1, 2, 3, 4, 5].map((n) => ({ name: `n${n}` })), 2)).toEqual(["n1", "n2"]);
  });
});

describe("summarize", () => {
  it("counts each kind", () => {
    const kinds: HubKind[] = ["live", "live", "degraded", "error", "configured", "unconfigured", "idle"];
    const c = summarize(kinds);
    expect(c).toMatchObject({ live: 2, degraded: 1, error: 1, configured: 1, unconfigured: 1, idle: 1, total: 7 });
  });
});

describe("remedyFor", () => {
  const csv: SourceEntry = { id: "p", label: "P", kind: "csv", owner: "x", cache: "build", regen: "npm run print-tracker" };
  const api: SourceEntry = { id: "w", label: "W", kind: "api", owner: "x", cache: "no-store", enabledEnv: ["WALGREENS_API_KEY"] };
  const research: SourceEntry = { id: "c", label: "C", kind: "api", owner: "x", cache: "force-dynamic", remedy: "Run /api/research/ingest" };
  const geo: SourceEntry = { id: "g", label: "G", kind: "geo", owner: "x", cache: "ISR" };

  it("CSV degraded → regenerate command", () => {
    expect(remedyFor(csv, "degraded")?.hint).toBe("npm run print-tracker");
  });
  it("API unconfigured → set env", () => {
    expect(remedyFor(api, "unconfigured")?.hint).toMatch(/WALGREENS_API_KEY/);
  });
  it("research degraded → its remedy string", () => {
    expect(remedyFor(research, "degraded")?.hint).toMatch(/ingest/);
  });
  it("geo degraded → informational upstream note", () => {
    expect(remedyFor(geo, "degraded")?.label).toBe("Upstream");
  });
  it("healthy states → no remedy", () => {
    expect(remedyFor(csv, "live")).toBeNull();
    expect(remedyFor(api, "configured")).toBeNull();
  });
});
