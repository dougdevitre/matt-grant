import { describe, it, expect } from "vitest";
import { normalizeWinred, extractWinredToken, classifyWinredEvent } from "@/lib/winred";

describe("classifyWinredEvent", () => {
  it("classifies created donations from common event fields", () => {
    expect(classifyWinredEvent({ event: "donation.created", amount: 100 })).toBe("created");
    expect(classifyWinredEvent({ type: "DonationCreated" })).toBe("created");
    expect(classifyWinredEvent({ status: "success" })).toBe("created");
  });

  it("classifies refunds (string event or refunded flag), top-level or nested", () => {
    expect(classifyWinredEvent({ event: "donation.refunded" })).toBe("refunded");
    expect(classifyWinredEvent({ data: { event_type: "Refund" } })).toBe("refunded");
    expect(classifyWinredEvent({ data: { refunded: true } })).toBe("refunded");
    expect(classifyWinredEvent({ refunded_at: "2026-06-21T00:00:00Z" })).toBe("refunded");
  });

  it("classifies a lost dispute as its own kind (also a reversal)", () => {
    expect(classifyWinredEvent({ event: "donation.dispute_lost" })).toBe("dispute_lost");
    expect(classifyWinredEvent({ type: "DisputeLost" })).toBe("dispute_lost");
  });

  it("returns unknown when no event signal is present (route treats as a gift if it has an amount)", () => {
    expect(classifyWinredEvent({ amount: 2500, donor: { email: "a@b.co" } })).toBe("unknown");
  });
});

describe("extractWinredToken", () => {
  it("reads the static `token` field from the top level of the body (WinRed's mechanism)", () => {
    expect(extractWinredToken({ token: "s3cret", amount: 100 }, null, null)).toBe("s3cret");
  });

  it("reads `token` nested under a { data: {...} } envelope", () => {
    expect(extractWinredToken({ data: { token: "s3cret" } }, null, null)).toBe("s3cret");
  });

  it("prefers the body token over header fallbacks", () => {
    expect(extractWinredToken({ token: "body" }, "Bearer hdr", "xhdr")).toBe("body");
  });

  it("falls back to a Bearer Authorization header for manual/direct posts", () => {
    expect(extractWinredToken({ amount: 100 }, "Bearer hdrtok", null)).toBe("hdrtok");
  });

  it("falls back to x-winred-token when no body token or bearer is present", () => {
    expect(extractWinredToken({ amount: 100 }, null, "xtok")).toBe("xtok");
  });

  it("returns empty string when no token is present anywhere (→ 401 upstream)", () => {
    expect(extractWinredToken({ amount: 100, email: "a@b.co" }, null, null)).toBe("");
  });

  it("ignores a non-string/empty token field", () => {
    expect(extractWinredToken({ token: "" }, null, null)).toBe("");
    expect(extractWinredToken({ token: 12345 as unknown as string }, null, null)).toBe("");
  });
});

describe("normalizeWinred", () => {
  it("parses the documented nested-donor shape (amount in cents → dollars)", () => {
    const r = normalizeWinred({
      id: "wr_abc",
      amount: 3500,
      recurring: true,
      created_at: "2026-06-19T00:00:00Z",
      donor: { first_name: "Jane", last_name: "Doe", email: "jane@example.com", employer: "Acme", occupation: "Engineer", city: "STL", state: "MO", zip: "63101" },
    });
    expect(r).toMatchObject({
      externalId: "wr_abc",
      amount: 35, // 3500 cents → $35
      name: "Jane Doe",
      email: "jane@example.com",
      employer: "Acme",
      state: "MO",
      recurring: true,
      donatedAt: "2026-06-19T00:00:00Z",
    });
  });

  it("unwraps a { data: {...} } envelope and reads flat billing fields", () => {
    const r = normalizeWinred({ data: { transaction_id: "t1", total_amount: 1000, billing: { first_name: "Sam", email: "sam@x.co" } } });
    expect(r.externalId).toBe("t1");
    expect(r.amount).toBe(10);
    expect(r.name).toBe("Sam");
    expect(r.email).toBe("sam@x.co");
  });

  it("treats a missing/zero/negative amount as undefined (no phantom $0 gift)", () => {
    expect(normalizeWinred({ email: "a@b.co" }).amount).toBeUndefined();
    expect(normalizeWinred({ amount: 0, email: "a@b.co" }).amount).toBeUndefined();
    expect(normalizeWinred({ amount: -50, email: "a@b.co" }).amount).toBeUndefined();
  });

  it("defaults recurring to false and omits name when no parts are present", () => {
    const r = normalizeWinred({ amount: 500, email: "x@y.co" });
    expect(r.recurring).toBe(false);
    expect(r.name).toBeUndefined();
  });

  it("trims and ignores blank strings", () => {
    const r = normalizeWinred({ amount: 500, donor: { first_name: "  Pat  ", last_name: "   ", email: "pat@x.co" } });
    expect(r.firstName).toBe("Pat");
    expect(r.lastName).toBeUndefined();
    expect(r.name).toBe("Pat");
  });

  it("is robust to a junk payload (returns no amount/email rather than throwing)", () => {
    const r = normalizeWinred({ random: { nested: true }, list: [1, 2, 3] });
    expect(r.amount).toBeUndefined();
    expect(r.email).toBeUndefined();
    expect(r.recurring).toBe(false);
  });
});
