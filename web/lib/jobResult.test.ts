import { describe, it, expect } from "vitest";
import { unauthorized, skipped, jobOk, jobFailed } from "@/lib/jobResult";

describe("jobResult envelope", () => {
  it("unauthorized → 401 { ok:false, error }", async () => {
    const r = unauthorized();
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ ok: false, error: "unauthorized" });
  });

  it("skipped → 200 { ok:true, skipped, ...extra }", async () => {
    const r = skipped("SES not configured", { counts: 3 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, skipped: "SES not configured", counts: 3 });
  });

  it("jobOk → 200 { ok:true, ...extra }", async () => {
    const r = jobOk({ batches: 2 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, batches: 2 });
  });

  it("jobFailed → given status { ok:false, error }", async () => {
    const r = jobFailed("drain failed", 500);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, error: "drain failed" });
  });
});
