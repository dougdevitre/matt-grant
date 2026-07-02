import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Exercises the extRoute contract through a real endpoint: capability gate + CORS +
// Resource envelope. Auth + data are mocked so it runs hermetically.
const checkCap = vi.fn();
const getOverview = vi.fn();
vi.mock("@/lib/auth", () => ({ checkCap: (cap: string) => checkCap(cap) }));
vi.mock("@/lib/queries", () => ({ getOverview: () => getOverview() }));

import { GET, OPTIONS } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const reqFrom = (origin: string) => new Request("http://test/api/ext/overview", { headers: { origin } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("GET /api/ext/overview", () => {
  it("403 (with CORS) for a caller lacking viewOverview", async () => {
    checkCap.mockResolvedValue({ allowed: false });
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("viewOverview");
    // The extension must be able to READ the 403, so it carries ACAO too.
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("200 with a Resource envelope + echoed CORS origin when allowed", async () => {
    checkCap.mockResolvedValue({ allowed: true });
    getOverview.mockResolvedValue({ connected: true, donorCount: 3 });
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
    const body = (await res.json()) as { ok: boolean; data: { donorCount: number }; meta: { source: string } };
    expect(body.ok).toBe(true);
    expect(body.data.donorCount).toBe(3);
    expect(body.meta.source).toBe("campaign overview");
  });

  it("does not emit ACAO for a non-allowlisted origin even when authorized", async () => {
    checkCap.mockResolvedValue({ allowed: true });
    getOverview.mockResolvedValue({ connected: true });
    const res = await GET(reqFrom("https://evil.example"));
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("OPTIONS preflight is 204 with CORS headers", async () => {
    const res = await OPTIONS(reqFrom(EXT));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
  });
});
