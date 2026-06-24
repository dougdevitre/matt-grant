import { describe, it, expect } from "vitest";
import { ok, fail, degraded, isDegraded, isEmpty, type Provenance } from "@/lib/data/resource";

const base: Provenance = { source: "test", kind: "api", live: true };

describe("Resource envelope", () => {
  it("ok() carries data and stays live", () => {
    const r = ok([1, 2], base);
    expect(r.ok).toBe(true);
    expect(isDegraded(r)).toBe(false);
    if (r.ok) expect(r.data).toEqual([1, 2]);
  });

  it("fail() forces live:false and exposes the error", () => {
    const r = fail("boom", base);
    expect(r.ok).toBe(false);
    expect(r.meta.live).toBe(false);
    if (!r.ok) expect(r.error).toBe("boom");
  });

  it("degraded() stays ok but flags the reason", () => {
    const r = degraded(["fallback"], "credentials not configured", base);
    expect(r.ok).toBe(true);
    expect(isDegraded(r)).toBe(true);
    expect(r.meta.live).toBe(false);
    expect(r.meta.degraded?.reason).toMatch(/credentials/);
  });

  it("isEmpty() detects empty arrays and empty FeatureCollections", () => {
    expect(isEmpty(ok([], base))).toBe(true);
    expect(isEmpty(ok([1], base))).toBe(false);
    expect(isEmpty(ok({ type: "FeatureCollection", features: [] }, base))).toBe(true);
    expect(isEmpty(ok({ type: "FeatureCollection", features: [{}] }, base))).toBe(false);
  });
});
