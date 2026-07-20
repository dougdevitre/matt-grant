import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the two data sources so we can assert the opted-in intersection logic
// without DynamoDB.
vi.mock("@/lib/sms/consent", () => ({
  optedInSet: vi.fn(),
  listConsent: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getVolunteers: vi.fn(),
}));
// The shipped crosswalk data is empty by design; mock one district so the
// district-token path is testable.
vi.mock("@/lib/sms/school-districts", () => {
  const FIXTURE = { "2900001": { id: "2900001", name: "Fixture District", counties: ["st-louis"] } };
  return {
    SCHOOL_DISTRICTS: FIXTURE,
    districtById: (id: string) => FIXTURE[id as keyof typeof FIXTURE] ?? null,
  };
});

import {
  resolveSmsRecipients,
  smsAudienceCounts,
  smsAudienceLabel,
  smsVolRoleCounts,
  smsCaptainTeamCount,
  smsTargetCounts,
  parseVolRole,
  parseTargetToken,
  OUTSTANDING_TOKEN,
} from "./audiences";
import { optedInSet, listConsent } from "@/lib/sms/consent";
import { getVolunteers } from "@/lib/queries";

const mockOpted = vi.mocked(optedInSet);
const mockListConsent = vi.mocked(listConsent);
const mockVols = getVolunteers as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockOpted.mockResolvedValue(new Set(["+13145550100", "+13145550101"]));
  // The resolver reads the full ledger (opt-in gate + targeting fields in one
  // read); keep it in lockstep with whatever set each test puts in mockOpted.
  mockListConsent.mockImplementation(async () =>
    [...(await mockOpted())].map((phone) => ({ phone, status: "opted_in" as const })),
  );
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

describe("targeting filters (county / zip / segment / outstanding)", () => {
  const LEDGER = [
    { phone: "+13145550100", status: "opted_in" as const, county: "franklin", zip: "63084", voterSegment: "MOBILIZE", banked: false },
    { phone: "+13145550101", status: "opted_in" as const, county: "st-louis", zip: "63011", voterSegment: "BANK", banked: true, schoolDistrict: "2900001" },
    { phone: "+13145550102", status: "opted_in" as const }, // no geo/tags (unenriched)
  ];
  beforeEach(() => {
    mockOpted.mockResolvedValue(new Set(LEDGER.map((r) => r.phone)));
    mockListConsent.mockResolvedValue(LEDGER);
    mockVols.mockResolvedValue({ connected: true, rows: [] });
  });

  it("parseTargetToken validates county/zip/segment/outstanding and rejects junk", () => {
    expect(parseTargetToken("county:franklin")).toEqual({ kind: "county", value: "franklin" });
    expect(parseTargetToken("zip:63011")).toEqual({ kind: "zip", value: "63011" });
    expect(parseTargetToken("segment:MOBILIZE")).toEqual({ kind: "segment", value: "MOBILIZE" });
    expect(parseTargetToken(OUTSTANDING_TOKEN)).toEqual({ kind: "outstanding" });
    expect(parseTargetToken("district:2900001")).toEqual({ kind: "district", value: "2900001" });
    for (const bad of ["county:st-charles", "zip:6301", "segment:nope", "district:0000000", "franklin", ""]) {
      expect(parseTargetToken(bad), bad).toBeNull();
    }
  });

  it("a district filter narrows to rows tagged with that district", async () => {
    const out = await resolveSmsRecipients(["subscribers"], [], [], { targets: ["district:2900001"] });
    expect(out.map((r) => r.phone)).toEqual(["+13145550101"]);
  });

  it("a county filter narrows to matching rows; unenriched rows are dropped", async () => {
    const out = await resolveSmsRecipients(["subscribers"], [], [], { targets: ["county:franklin"] });
    expect(out.map((r) => r.phone)).toEqual(["+13145550100"]);
  });

  it("multiple tokens of one kind OR together; kinds AND together", async () => {
    const both = await resolveSmsRecipients(["subscribers"], [], [], { targets: ["county:franklin", "county:st-louis"] });
    expect(new Set(both.map((r) => r.phone))).toEqual(new Set(["+13145550100", "+13145550101"]));
    const anded = await resolveSmsRecipients(["subscribers"], [], [], {
      targets: ["county:franklin", "county:st-louis", "segment:BANK"],
    });
    expect(anded.map((r) => r.phone)).toEqual(["+13145550101"]);
  });

  it("outstanding drops only CONFIRMED-banked rows — unenriched rows stay in", async () => {
    const out = await resolveSmsRecipients(["subscribers"], [], [], { targets: [OUTSTANDING_TOKEN] });
    expect(new Set(out.map((r) => r.phone))).toEqual(new Set(["+13145550100", "+13145550102"]));
  });

  it("a zip filter matches self-reported/enriched zips", async () => {
    const out = await resolveSmsRecipients(["subscribers"], [], [], { targets: ["zip:63011", "zip:63017"] });
    expect(out.map((r) => r.phone)).toEqual(["+13145550101"]);
  });

  it("invalid tokens are ignored — they can only narrow, never widen or error", async () => {
    const out = await resolveSmsRecipients(["subscribers"], [], [], { targets: ["county:st-charles", "junk"] });
    expect(out.length).toBe(3); // no VALID token → no filtering
  });

  it("smsTargetCounts counts opted-in rows per chip token", async () => {
    const c = await smsTargetCounts();
    expect(c["county:franklin"]).toBe(1);
    expect(c["county:st-louis"]).toBe(1);
    expect(c["segment:MOBILIZE"]).toBe(1);
    expect(c["segment:BANK"]).toBe(1);
    expect(c["district:2900001"]).toBe(1);
    expect(c[OUTSTANDING_TOKEN]).toBe(2); // 0100 (not banked) + 0102 (unknown)
  });

  it("labels append the filter descriptions", () => {
    expect(smsAudienceLabel(["subscribers"], [], [], ["county:franklin", OUTSTANDING_TOKEN])).toBe(
      "All opted-in · Franklin County, not yet voted",
    );
    expect(smsAudienceLabel([], [], [], ["zip:63011"])).toBe("ZIP 63011");
    expect(smsAudienceLabel([], [], [], ["district:2900001"])).toBe("Fixture District");
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

describe("captain scope — resolveSmsRecipients(opts.captainEmail) + smsCaptainTeamCount", () => {
  beforeEach(() => {
    mockOpted.mockResolvedValue(new Set(["+13145550100", "+13145550101", "+13145550103"]));
    mockVols.mockResolvedValue({
      connected: true,
      rows: [
        { phone: "314-555-0100", name: "My Canvasser", roles: ["Canvasser"], door: "Volunteer", captainEmail: "cap@x.com", optedOut: false },
        { phone: "314-555-0101", name: "My Poller", roles: ["Poll Watcher"], door: "Volunteer", captainEmail: "CAP@X.com", optedOut: false }, // case-insensitive
        { phone: "314-555-0103", name: "Other Team", roles: ["Canvasser"], door: "Volunteer", captainEmail: "other@x.com", optedOut: false },
      ],
    });
  });

  it("with no tokens, sends to the captain's WHOLE opted-in team only", async () => {
    const out = await resolveSmsRecipients([], [], [], { captainEmail: "cap@x.com" });
    expect(new Set(out.map((r) => r.phone))).toEqual(new Set(["+13145550100", "+13145550101"])); // 0103 (other team) excluded
    expect(out.find((r) => r.phone === "+13145550100")?.first).toBe("My"); // carries first name for {first}
  });

  it("ignores a subscribers group + Clerk roles passed alongside a captain scope", async () => {
    // Even with subscribers requested, a captain never reaches the full opt-in ledger.
    const out = await resolveSmsRecipients(["subscribers", "volunteers"], ["admin"], [], { captainEmail: "cap@x.com" });
    expect(new Set(out.map((r) => r.phone))).toEqual(new Set(["+13145550100", "+13145550101"]));
  });

  it("still sub-filters the team by a volunteer-role token", async () => {
    const out = await resolveSmsRecipients([], [], ["role:Canvasser"], { captainEmail: "cap@x.com" });
    expect(out.map((r) => r.phone)).toEqual(["+13145550100"]); // only my Canvasser; 0103 is another captain's
  });

  it("unset opts is identical to a normal volunteers-group send (no regression)", async () => {
    const scoped = await resolveSmsRecipients(["volunteers"], [], [], {});
    const plain = await resolveSmsRecipients(["volunteers"]);
    expect(scoped).toEqual(plain);
  });

  it("smsCaptainTeamCount counts only the captain's opted-in team", async () => {
    expect(await smsCaptainTeamCount("cap@x.com")).toBe(2); // 0100 + 0101; 0103 is another team
    expect(await smsCaptainTeamCount("")).toBe(0);
  });

  it("smsVolRoleCounts(captainEmail) scopes chip counts to the captain's team", async () => {
    const c = await smsVolRoleCounts("cap@x.com");
    expect(c["role:Canvasser"]).toBe(1); // only my Canvasser, not the other team's
    expect(c["role:Poll Watcher"]).toBe(1);
  });
});
