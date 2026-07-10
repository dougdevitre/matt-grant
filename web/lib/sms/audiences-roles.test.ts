import { describe, it, expect, vi, beforeEach } from "vitest";

// Prove SMS role targeting is opted-in BY CONSTRUCTION: a Clerk account with role X is only
// texted if its phone is in the consent ledger (and not blocked).
vi.mock("@/lib/queries", () => ({ getVolunteers: async () => ({ rows: [] }) }));
vi.mock("@/lib/sms/consent", () => ({ optedInSet: async () => new Set(["+13145550001"]) })); // only this one opted in
vi.mock("@/lib/sms/moderation", () => ({ listBlocked: async () => [{ phone: "+13145559999" }] }));
vi.mock("@/lib/sms/send", () => ({ toE164: (p: string) => (p?.startsWith("+") ? p : null) }));
const listClerkContactsByRole = vi.fn();
vi.mock("@/lib/clerkAudiences", () => ({ listClerkContactsByRole: (...a: unknown[]) => listClerkContactsByRole(...a) }));

import { resolveSmsRecipients, smsAudienceLabel } from "./audiences";

beforeEach(() => listClerkContactsByRole.mockReset());

describe("resolveSmsRecipients — Clerk role targeting", () => {
  it("texts only opted-in numbers for a targeted role", async () => {
    listClerkContactsByRole.mockResolvedValue([
      { email: null, phone: "+13145550001" }, // opted in → included
      { email: null, phone: "+13145550002" }, // not opted in → excluded
      { email: null, phone: null }, // no phone → excluded
    ]);
    const out = await resolveSmsRecipients([], ["volunteer"]);
    expect(out.map((r) => r.phone)).toEqual(["+13145550001"]);
  });

  it("carries the Clerk contact's first name for personalization", async () => {
    listClerkContactsByRole.mockResolvedValue([{ email: null, phone: "+13145550001", firstName: "Jordan" }]);
    expect(await resolveSmsRecipients([], ["volunteer"])).toEqual([{ phone: "+13145550001", first: "Jordan" }]);
  });

  it("excludes blocked numbers even if opted in", async () => {
    listClerkContactsByRole.mockResolvedValue([{ email: null, phone: "+13145559999" }]); // blocked
    expect(await resolveSmsRecipients([], ["admin"])).toEqual([]);
  });

  it("smsAudienceLabel includes role labels", () => {
    expect(smsAudienceLabel(["subscribers"], ["volunteer"])).toBe("All opted-in + Role: Volunteer");
  });
});
