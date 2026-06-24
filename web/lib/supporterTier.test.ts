import { vi, describe, it, expect, beforeEach } from "vitest";
import type { DonorSummary } from "@/lib/donorStatus";

// Mock the donor primitive and the data layer. The fake ddb.send answers a Get
// (volunteer email-key) from volGetItem and a Query (partition fallback) from
// volQueryItems, recording which ran so we can assert the self-scoped lookups.
const h = vi.hoisted(() => ({
  donor: { hasDonated: false, totalCents: 0, gifts: 0 } as DonorSummary,
  volGetItem: undefined as unknown,
  volQueryItems: [] as { email?: string }[],
  calls: [] as string[],
}));

vi.mock("@/lib/donorStatus", () => ({
  donorSummaryForEmail: vi.fn(async () => h.donor),
}));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: { Key?: unknown } }) => {
      if (cmd.input.Key) {
        h.calls.push("get");
        return { Item: h.volGetItem };
      }
      h.calls.push("query");
      return { Items: h.volQueryItems };
    }),
  },
  TABLE: "T",
  PK: { volunteers: "VOLUNTEER", donors: "DONOR" },
  dbConfigured: true,
}));

import { supporterTierForEmail } from "@/lib/supporterTier";

beforeEach(() => {
  h.donor = { hasDonated: false, totalCents: 0, gifts: 0 };
  h.volGetItem = undefined;
  h.volQueryItems = [];
  h.calls = [];
});

describe("supporterTierForEmail", () => {
  it("returns the base supporter tier for a blank email and never queries", async () => {
    expect(await supporterTierForEmail(null)).toEqual({
      tier: "supporter",
      isDonor: false,
      isVolunteer: false,
      donor: { hasDonated: false, totalCents: 0, gifts: 0 },
    });
    expect(h.calls).toEqual([]);
  });

  it("is a plain supporter when there's no donor row and no volunteer record", async () => {
    const t = await supporterTierForEmail("a@b.co");
    expect(t.tier).toBe("supporter");
    expect(t.isDonor).toBe(false);
    expect(t.isVolunteer).toBe(false);
    expect(h.calls).toEqual(["get", "query"]); // tried the keyed read, then the fallback
  });

  it("recognizes a volunteer via the email-keyed record (no partition scan needed)", async () => {
    h.volGetItem = { name: "Sam" };
    const t = await supporterTierForEmail("a@b.co");
    expect(t.tier).toBe("volunteer");
    expect(t.isVolunteer).toBe(true);
    expect(h.calls).toEqual(["get"]); // short-circuits before the scan
  });

  it("recognizes a volunteer via the partition fallback (case-insensitive email match)", async () => {
    h.volQueryItems = [{ email: "Other@x.co" }, { email: "A@B.co" }];
    const t = await supporterTierForEmail("a@b.co");
    expect(t.tier).toBe("volunteer");
    expect(t.isVolunteer).toBe(true);
  });

  it("ranks donor above volunteer and carries the giving summary", async () => {
    h.donor = { hasDonated: true, totalCents: 7500, gifts: 2 };
    h.volGetItem = { name: "Sam" }; // also a volunteer
    const t = await supporterTierForEmail("a@b.co");
    expect(t.tier).toBe("donor");
    expect(t.isDonor).toBe(true);
    expect(t.isVolunteer).toBe(true);
    expect(t.donor).toEqual({ hasDonated: true, totalCents: 7500, gifts: 2 });
  });
});
