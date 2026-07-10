import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the two data sources so we can assert the opted-in intersection logic
// without DynamoDB.
vi.mock("@/lib/sms/consent", () => ({
  optedInSet: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getVolunteers: vi.fn(),
}));

import { resolveSmsRecipients, smsAudienceCounts, smsAudienceLabel, smsVolRoleCounts, parseVolRole } from "./audiences";
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
  const phones = (r: { phone: string }[]) => r.map((x) => x.phone);

  it("subscribers = the full opted-in set (phone-only, no name)", async () => {
    const r = await resolveSmsRecipients(["subscribers"]);
    expect(new Set(phones(r))).toEqual(new Set(["+13145550100", "+13145550101"]));
    expect(r.every((x) => x.first === undefined)).toBe(true); // ledger carries no name
  });

  it("volunteers = only volunteer phones that are opted in, carrying the first name", async () => {
    const r = await resolveSmsRecipients(["volunteers"]);
    expect(r).toEqual([{ phone: "+13145550100", first: "Opted" }]); // 0999 excluded, null skipped
  });

  it("unions + de-dupes across groups; a named source upgrades a nameless subscriber entry", async () => {
    const r = await resolveSmsRecipients(["subscribers", "volunteers"]);
    expect(new Set(phones(r))).toEqual(new Set(["+13145550100", "+13145550101"]));
    expect(r.length).toBe(2); // +13145550100 not duplicated
    expect(r.find((x) => x.phone === "+13145550100")?.first).toBe("Opted"); // volunteer name wins
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
  it("appends volunteer-role labels", () => {
    expect(smsAudienceLabel([], [], ["role:Canvasser", "door:Team Captain"])).toBe("Canvasser + Door: Team Captain");
  });
});

describe("parseVolRole", () => {
  it("accepts taxonomy roles/doors and rejects everything else", () => {
    expect(parseVolRole("role:Canvasser")).toEqual({ kind: "role", value: "Canvasser" });
    expect(parseVolRole("door:Team Captain")).toEqual({ kind: "door", value: "Team Captain" });
    expect(parseVolRole("role:NotARealRole")).toBeNull();
    expect(parseVolRole("door:Nope")).toBeNull();
    expect(parseVolRole("Canvasser")).toBeNull(); // no namespace
  });
});

describe("volunteer-role targeting + opt-out reconciliation", () => {
  beforeEach(() => {
    // 0102 is opted_in in the ledger but flagged optedOut on the roster (e.g. an
    // email unsubscribe-all) — it must be dropped from volunteer sourcing.
    mockOpted.mockResolvedValue(new Set(["+13145550100", "+13145550101", "+13145550102"]));
    mockVols.mockResolvedValue({
      connected: true,
      rows: [
        { phone: "314-555-0100", roles: ["Canvasser", "Phone Banker"], door: "Volunteer", optedOut: false },
        { phone: "314-555-0101", roles: ["Poll Watcher"], door: "Team Captain", optedOut: false },
        { phone: "314-555-0102", roles: ["Canvasser"], door: "Volunteer", optedOut: true }, // roster opt-out
      ],
    });
  });

  it("selects opted-in volunteers by role token, excluding roster opt-outs", async () => {
    expect((await resolveSmsRecipients([], [], ["role:Canvasser"])).map((r) => r.phone)).toEqual(["+13145550100"]);
  });

  it("selects by door token", async () => {
    expect((await resolveSmsRecipients([], [], ["door:Team Captain"])).map((r) => r.phone)).toEqual(["+13145550101"]);
  });

  it("the volunteers GROUP also honors the roster opt-out (0102 excluded)", async () => {
    expect(new Set((await resolveSmsRecipients(["volunteers"])).map((r) => r.phone))).toEqual(new Set(["+13145550100", "+13145550101"]));
  });

  it("de-dupes a volunteer matched by two tokens", async () => {
    expect((await resolveSmsRecipients([], [], ["role:Canvasser", "role:Phone Banker"])).map((r) => r.phone)).toEqual(["+13145550100"]);
  });

  it("smsVolRoleCounts counts opted-in members per token (opt-outs excluded)", async () => {
    const c = await smsVolRoleCounts();
    expect(c["role:Canvasser"]).toBe(1); // 0100 only; 0102 opted out
    expect(c["role:Phone Banker"]).toBe(1);
    expect(c["role:Poll Watcher"]).toBe(1);
    expect(c["door:Volunteer"]).toBe(1);
    expect(c["door:Team Captain"]).toBe(1);
  });
});
