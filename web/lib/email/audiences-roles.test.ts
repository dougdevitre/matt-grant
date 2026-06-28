import { describe, it, expect, vi, beforeEach } from "vitest";

// Prove the Clerk-role targeting added to resolveRecipients: role recipients are included,
// de-duped with other sources, and the `internal` (bypass-topic-opt-outs) flag flips correctly
// for staff vs external roles. Heavy data stores are mocked to empty so the test isolates roles.
vi.mock("@/lib/queries", () => ({ getVolunteers: async () => ({ rows: [] }), getDonors: async () => ({ rows: [] }) }));
vi.mock("@/lib/staff", () => ({ listStaff: async () => [] }));
vi.mock("@/lib/profile", () => ({ segmentEmails: async () => [], isWayToHelp: () => false }));
vi.mock("@/lib/integrations/research/issues", () => ({ isIssueId: () => false }));
const listClerkContactsByRole = vi.fn();
vi.mock("@/lib/clerkAudiences", () => ({ listClerkContactsByRole: (...a: unknown[]) => listClerkContactsByRole(...a) }));

import { resolveRecipients } from "./audiences";
import { audienceLabel } from "./audienceGroups";

beforeEach(() => listClerkContactsByRole.mockReset());

describe("resolveRecipients — Clerk role targeting", () => {
  it("includes recipients for a targeted role", async () => {
    listClerkContactsByRole.mockResolvedValue([
      { email: "Donor1@x.com", phone: null, firstName: "Dee" },
      { email: "donor2@x.com", phone: null },
    ]);
    const { recipients } = await resolveRecipients([], undefined, ["donor"]);
    expect(recipients.map((r) => r.email).sort()).toEqual(["donor1@x.com", "donor2@x.com"]); // lowercased
    expect(recipients.find((r) => r.email === "donor1@x.com")?.firstName).toBe("Dee");
  });

  it("a staff-only role send is internal (bypasses topic opt-outs)", async () => {
    listClerkContactsByRole.mockResolvedValue([{ email: "vol@x.com", phone: null }]);
    const { internal } = await resolveRecipients([], undefined, ["volunteer"]);
    expect(internal).toBe(true);
  });

  it("an external role makes the send external (honors topic opt-outs)", async () => {
    listClerkContactsByRole.mockResolvedValue([{ email: "s@x.com", phone: null }]);
    expect((await resolveRecipients([], undefined, ["supporter"])).internal).toBe(false);
    expect((await resolveRecipients([], undefined, ["donor"])).internal).toBe(false);
    expect((await resolveRecipients([], undefined, ["partner"])).internal).toBe(false);
  });

  it("mixing a staff group with an external role is external", async () => {
    listClerkContactsByRole.mockResolvedValue([{ email: "d@x.com", phone: null }]);
    const { internal } = await resolveRecipients(["captains"], undefined, ["donor"]);
    expect(internal).toBe(false);
  });

  it("de-dupes an address that appears in two roles", async () => {
    listClerkContactsByRole.mockResolvedValue([{ email: "dup@x.com", phone: null }]);
    const { recipients } = await resolveRecipients([], undefined, ["admin", "captain"]);
    expect(recipients).toHaveLength(1);
  });

  it("no selection at all → not internal, no recipients", async () => {
    const { recipients, internal } = await resolveRecipients([], undefined, []);
    expect(recipients).toEqual([]);
    expect(internal).toBe(false);
  });

  it("audienceLabel includes role labels", () => {
    expect(audienceLabel(["volunteers"], undefined, ["donor", "captain"])).toBe("Volunteers + Role: Donor + Role: Captain");
  });
});
