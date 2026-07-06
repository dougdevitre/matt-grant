import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Exercises the captain-scoped /api/ext/me contract: capability gate + CORS + Resource
// envelope, and that the payload is derived from the SESSION email (self-scoped). Auth
// + the personal-signals gatherer are mocked so it runs hermetically.
const checkCap = vi.fn();
const gatherPersonalSignals = vi.fn();
vi.mock("@/lib/auth", () => ({ checkCap: (cap: string) => checkCap(cap) }));
vi.mock("@/lib/dashboard/personal-data", () => ({
  gatherPersonalSignals: (email: string, role: string) => gatherPersonalSignals(email, role),
}));

import { GET, OPTIONS } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const reqFrom = (origin: string) => new Request("http://test/api/ext/me", { headers: { origin } });

const SIGNALS = {
  role: "captain",
  isVolunteer: true,
  registeredToVote: true,
  hasDonated: true,
  captainName: null,
  myTask: null,
  topAction: null,
  nextEvent: null,
  daysToPrimary: 30,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("GET /api/ext/me", () => {
  it("403 (with CORS) for a caller lacking viewOverview", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null, role: null } });
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("viewOverview");
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("200 with next step + checklist, scoped to the session email", async () => {
    checkCap.mockResolvedValue({ allowed: true, gate: { email: "cap@x.org", role: "captain" } });
    gatherPersonalSignals.mockResolvedValue(SIGNALS);
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    // The payload must come from the authenticated email, never a request field.
    expect(gatherPersonalSignals).toHaveBeenCalledWith("cap@x.org", "captain");
    const body = (await res.json()) as {
      ok: boolean;
      data: { nextStep: { kind: string }; progress: { total: number }; daysToPrimary: number };
      meta: { source: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.nextStep.kind).toBeTruthy();
    expect(body.data.progress.total).toBeGreaterThan(0);
    expect(body.data.daysToPrimary).toBe(30);
    expect(body.meta.source).toBe("my next step");
  });

  it("502 (with CORS) when the gatherer throws", async () => {
    checkCap.mockResolvedValue({ allowed: true, gate: { email: "cap@x.org", role: "captain" } });
    gatherPersonalSignals.mockRejectedValue(new Error("db down"));
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(502);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
  });

  it("OPTIONS preflight is 204 with CORS headers", async () => {
    const res = await OPTIONS(reqFrom(EXT));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
  });
});
