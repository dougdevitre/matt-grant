import { describe, it, expect, vi } from "vitest";

// With no DB, loadChildActBills must degrade (ok:true + meta.degraded + empty bills)
// rather than throw — so the read view + /api/research/child-act render a notice, not
// a 500. Mock the store as unconnected before importing the module under test.
vi.mock("@/lib/db", () => ({ dbConfigured: false }));

// eslint-disable-next-line import/first
import { loadChildActBills } from "./childActView";

describe("loadChildActBills (store unconnected)", () => {
  it("degrades gracefully instead of throwing", async () => {
    const res = await loadChildActBills();
    expect(res.ok).toBe(true);
    expect(res.meta.degraded?.reason).toMatch(/not connected/i);
    if (res.ok) {
      expect(res.data.configured).toBe(false);
      expect(res.data.bills).toEqual([]);
      expect(res.data.byTier).toEqual({ core: 0, related: 0, tangential: 0 });
      expect(res.data.note).toBeTruthy();
    }
  });
});
