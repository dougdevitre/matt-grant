import { describe, it, expect } from "vitest";
import { geoRoute } from "@/lib/data/geo";

const fc = (n: number): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: Array.from({ length: n }, () => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Point", coordinates: [0, 0] },
  })),
});

const sample = fc(2);

describe("geoRoute", () => {
  it("serves live data with live:true and a count, merging route meta", async () => {
    const GET = geoRoute({
      source: "test",
      fallback: sample,
      fetcher: async () => ({ fc: fc(5), meta: { pollingLive: true, coverage: "MO-02" } }),
    });
    const body = await (await GET()).json();
    expect(body.type).toBe("FeatureCollection");
    expect(body.features).toHaveLength(5);
    expect(body.meta.live).toBe(true);
    expect(body.meta.count).toBe(5);
    expect(body.meta.pollingLive).toBe(true);
    expect(body.meta.coverage).toBe("MO-02");
    expect(body.meta.degraded).toBeUndefined();
  });

  it("falls back (live:false + degraded) when the fetcher returns nothing", async () => {
    const GET = geoRoute({ source: "test", fallback: sample, fetcher: async () => ({ fc: null }) });
    const body = await (await GET()).json();
    expect(body.features).toHaveLength(2); // the fallback
    expect(body.meta.live).toBe(false);
    expect(body.meta.degraded.reason).toMatch(/sample/);
  });

  it("falls back with the error reason when the fetcher throws — never propagates", async () => {
    const GET = geoRoute({
      source: "test",
      fallback: sample,
      fetcher: async () => {
        throw new Error("ArcGIS 503");
      },
    });
    const body = await (await GET()).json();
    expect(body.features).toHaveLength(2);
    expect(body.meta.live).toBe(false);
    expect(body.meta.degraded.reason).toMatch(/503/);
  });
});
