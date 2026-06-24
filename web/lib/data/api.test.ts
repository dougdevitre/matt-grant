import { describe, it, expect } from "vitest";
import { z } from "zod";
import { loadApi } from "@/lib/data/api";

const ok3 = async () => [1, 2, 3];
const boom = async () => {
  throw new Error("upstream 502");
};

describe("loadApi degradation", () => {
  it("returns ok with a count on success", async () => {
    const r = await loadApi(ok3, { source: "test" });
    expect(r.ok).toBe(true);
    expect(r.meta.count).toBe(3);
  });

  it("degrades (stays ok) when disabled but a fallback is given", async () => {
    const r = await loadApi(ok3, { source: "test", enabled: false, fallback: [] });
    expect(r.ok).toBe(true);
    expect(r.meta.degraded?.reason).toMatch(/credentials/);
    if (r.ok) expect(r.data).toEqual([]);
  });

  it("fails (no fallback) when disabled", async () => {
    const r = await loadApi(ok3, { source: "test", enabled: false });
    expect(r.ok).toBe(false);
  });

  it("degrades on a thrown error when a fallback is given — never throws", async () => {
    const r = await loadApi(boom, { source: "test", fallback: [] });
    expect(r.ok).toBe(true);
    expect(r.meta.degraded?.reason).toMatch(/502/);
  });

  it("fails on a schema mismatch without a fallback", async () => {
    const r = await loadApi(async () => ({ nope: true }), {
      source: "test",
      schema: z.array(z.number()),
    });
    expect(r.ok).toBe(false);
  });
});
