import { describe, it, expect } from "vitest";
import { normalizeWinred } from "@/lib/winred";

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
