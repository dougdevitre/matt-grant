import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the two data sources so we can assert the opted-in intersection logic
// without DynamoDB.
vi.mock("@/lib/sms/consent", () => ({
  optedInSet: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getVolunteers: vi.fn(),
}));

import { resolveSmsRecipients, smsAudienceCounts, smsAudienceLabel } from "./audiences";
import { optedInSet } from "@/lib/sms/consent";
import { getVolunteers } from "@/lib/queries";

const mockOpted = optedInSet as unknown as ReturnType<typeof vi.fn>;
const mockVols = getVolunteers as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockOpted.mockResolvedValue(new Set(["+13145550100", "+13145550101"]));
  mockVols.mockResolvedValue({
    connected: true,
    rows: [
      { phone: "314-555-0100", name: "Opted In Vol" }, // normalizes to +13145550100 (opted in)
      { phone: "314-555-0999", name: "Not Opted Vol" }, // +13145550999 (NOT opted in → excluded)
      { phone: null, name: "No Phone" },
    ],
  });
});

describe("resolveSmsRecipients", () => {
  it("subscribers = the full opted-in set", async () => {
    const r = await resolveSmsRecipients(["subscribers"]);
    expect(new Set(r)).toEqual(new Set(["+13145550100", "+13145550101"]));
  });

  it("volunteers = only volunteer phones that are opted in (normalized)", async () => {
    const r = await resolveSmsRecipients(["volunteers"]);
    expect(r).toEqual(["+13145550100"]); // 0999 excluded (not opted in), null skipped
  });

  it("unions + de-dupes across groups", async () => {
    const r = await resolveSmsRecipients(["subscribers", "volunteers"]);
    expect(new Set(r)).toEqual(new Set(["+13145550100", "+13145550101"]));
    expect(r.length).toBe(2); // +13145550100 not duplicated
  });
});

describe("smsAudienceCounts", () => {
  it("counts opted-in subscribers and opted-in volunteers", async () => {
    expect(await smsAudienceCounts()).toEqual({ subscribers: 2, volunteers: 1 });
  });
});

describe("smsAudienceLabel", () => {
  it("joins group labels", () => {
    expect(smsAudienceLabel(["subscribers", "volunteers"])).toBe("All opted-in + Volunteers");
    expect(smsAudienceLabel([])).toBe("—");
  });
});
