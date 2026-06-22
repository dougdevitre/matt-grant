import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the data layer: the GetCommand returns h.item, and we capture the Key so we
// can assert the lookup is keyed by the caller's OWN email (self-scoped).
const h = vi.hoisted(() => ({ key: null as unknown, item: undefined as unknown }));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: { Key?: unknown } }) => {
      h.key = cmd.input.Key;
      return { Item: h.item };
    }),
  },
  TABLE: "T",
  PK: { donors: "DONOR" },
  dbConfigured: true,
}));

import { donorSummaryForEmail } from "@/lib/donorStatus";

beforeEach(() => {
  h.key = null;
  h.item = undefined;
});

describe("donorSummaryForEmail", () => {
  it("returns no-donor for a blank email and never queries", async () => {
    expect(await donorSummaryForEmail(null)).toEqual({ hasDonated: false, totalCents: 0, gifts: 0 });
    expect(h.key).toBeNull();
  });

  it("queries by the caller's OWN lowercased email key (self-scoped)", async () => {
    h.item = { contributions: [{ amountCents: 2500 }] };
    await donorSummaryForEmail("Donor@Example.com");
    expect(h.key).toEqual({ PK: "DONOR", SK: "e:donor@example.com" });
  });

  it("sums positive gifts into a donor summary", async () => {
    h.item = { contributions: [{ amountCents: 2500 }, { amountCents: 5000 }] };
    expect(await donorSummaryForEmail("a@b.co")).toEqual({ hasDonated: true, totalCents: 7500, gifts: 2 });
  });

  it("nets out refunds — a fully-refunded donor is not shown the donor view", async () => {
    h.item = { contributions: [{ amountCents: 5000 }, { amountCents: -5000 }] };
    expect(await donorSummaryForEmail("a@b.co")).toEqual({ hasDonated: false, totalCents: 0, gifts: 0 });
  });

  it("returns no-donor when there's no contribution row", async () => {
    h.item = undefined;
    expect(await donorSummaryForEmail("nobody@x.co")).toEqual({ hasDonated: false, totalCents: 0, gifts: 0 });
  });
});
