import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Exercises the captain-scoped /api/ext/team contract: capability gate + CORS +
// Resource envelope, and that every read is scoped to the SESSION email (a captain
// only ever sees their own team). The readers are mocked so it runs hermetically.
const checkCap = vi.fn();
const getCaptainTeam = vi.fn();
const listCaptainEvents = vi.fn();
const gatherCaptainScorecard = vi.fn();
vi.mock("@/lib/auth", () => ({ checkCap: (cap: string) => checkCap(cap) }));
vi.mock("@/lib/volunteers/team", () => ({ getCaptainTeam: (e: string) => getCaptainTeam(e) }));
vi.mock("@/lib/events", () => ({ listCaptainEvents: (e: string) => listCaptainEvents(e) }));
vi.mock("@/lib/volunteers/score-data", () => ({ gatherCaptainScorecard: (e: string) => gatherCaptainScorecard(e) }));

import { GET, OPTIONS } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const reqFrom = (origin: string) => new Request("http://test/api/ext/team", { headers: { origin } });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("GET /api/ext/team", () => {
  it("403 (with CORS) for a caller lacking manageVolunteers", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(403);
    expect(checkCap).toHaveBeenCalledWith("manageVolunteers");
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
  });

  it("200 with roster/summary/events, all scoped to the session email", async () => {
    checkCap.mockResolvedValue({ allowed: true, gate: { email: "cap@x.org" } });
    gatherCaptainScorecard.mockResolvedValue({ email: "cap@x.org", signals: { rosterSize: 2 } });
    getCaptainTeam.mockResolvedValue([
      { id: "v1", name: "Ann", status: "ACTIVE", city: "STL", lastContactedAt: "2026-06-01", phone: "555", email: "ann@x" },
    ]);
    listCaptainEvents.mockResolvedValue([
      { id: "e1", title: "Canvass", type: "canvass", start: "2026-07-10T15:00:00Z", status: "PUBLISHED", location: { name: "HQ", city: "STL" } },
    ]);
    const res = await GET(reqFrom(EXT));
    expect(res.status).toBe(200);
    // Every reader keyed off the authenticated email.
    expect(getCaptainTeam).toHaveBeenCalledWith("cap@x.org");
    expect(listCaptainEvents).toHaveBeenCalledWith("cap@x.org");
    expect(gatherCaptainScorecard).toHaveBeenCalledWith("cap@x.org");
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        roster: Array<Record<string, unknown>>;
        events: Array<{ location: string }>;
        summary: { signals: { rosterSize: number } };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.summary.signals.rosterSize).toBe(2);
    // Roster is trimmed to a glance — no phone/email leak into the popup payload.
    expect(body.data.roster[0]).not.toHaveProperty("phone");
    expect(body.data.roster[0]).not.toHaveProperty("email");
    expect(body.data.events[0].location).toBe("HQ");
  });

  it("OPTIONS preflight is 204 with CORS headers", async () => {
    const res = await OPTIONS(reqFrom(EXT));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(EXT);
  });
});
