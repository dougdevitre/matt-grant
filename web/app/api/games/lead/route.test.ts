import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The route captures a game lead in Airtable AND (the fix under test) writes SMS
// consent to the ledger so a consented number is actually textable. Mock the
// request-scoped rate limiter, the secret loader, and the consent ledger; leave
// toE164 (pure) real so E.164 normalization is exercised for real.
const { getSecret } = vi.hoisted(() => ({ getSecret: vi.fn() }));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { recordConsent } = vi.hoisted(() => ({ recordConsent: vi.fn() }));

vi.mock("@/lib/ssm", () => ({ getSecret }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit, clientIp: () => "203.0.113.5" }));
vi.mock("@/lib/sms/consent", () => ({ recordConsent }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://test/api/games/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  recordConsent.mockResolvedValue(true);
  rateLimit.mockResolvedValue({ allowed: true, count: 1, limit: 8, resetAt: 0 });
  getSecret.mockImplementation(async (n: string) =>
    n === "AIRTABLE_API_KEY" ? "key" : n === "GAMES_LEAD_BASE_ID" ? "appX" : n === "GAMES_LEAD_TABLE_ID" ? "tblX" : undefined,
  );
  // Airtable create succeeds by default.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ records: [{ id: "rec1" }] }), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("games lead → SMS consent ledger", () => {
  it("records consent for a consented lead with a valid phone", async () => {
    const res = await post({ gameId: "four-fights", phone: "314-555-0100", smsConsent: true });
    expect(res.status).toBe(200);
    expect(recordConsent).toHaveBeenCalledTimes(1);
    expect(recordConsent).toHaveBeenCalledWith("+13145550100", "games-lead");
  });

  it("does NOT record consent for an email-only lead (no phone / no consent)", async () => {
    const res = await post({ gameId: "four-fights", email: "pat@example.com" });
    expect(res.status).toBe(200);
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("does NOT record consent when the phone can't be normalized to E.164", async () => {
    // Passes the schema (7–20 chars + consent) but toE164 rejects 7 digits.
    const res = await post({ gameId: "four-fights", phone: "555-0100", smsConsent: true });
    expect(res.status).toBe(200);
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("does NOT record consent when the Airtable capture failed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("err", { status: 500 })));
    const res = await post({ gameId: "four-fights", phone: "314-555-0100", smsConsent: true });
    expect(res.status).toBe(502);
    expect(recordConsent).not.toHaveBeenCalled();
  });
});
