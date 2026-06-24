import { describe, it, expect, vi } from "vitest";

// Mock the data sources so the resolver runs without a database.
vi.mock("@/lib/queries", () => ({
  getVolunteers: vi.fn(async () => ({ connected: true, rows: [{ email: "Vol@X.com", name: "Volly Smith" }, { email: "dup@x.com" }, { email: null }] })),
  getDonors: vi.fn(async () => ({ connected: true, rows: [{ email: "donor@x.com" }, { email: "dup@x.com" }] })),
}));
vi.mock("@/lib/staff", () => ({
  listStaff: vi.fn(async () => [
    { email: "cap@x.com", role: "captain", status: "active" },
    { email: "admin@x.com", role: "admin", status: "active" },
    { email: "member@x.com", role: "member", status: "active" },
    { email: "old@x.com", role: "captain", status: "removed" },
    { email: "partner@x.com", role: "partner", status: "active" },
  ]),
}));
// Keep isWayToHelp/isIssueId real; only stub segmentEmails.
vi.mock("@/lib/profile", async (orig) => ({
  ...(await orig<typeof import("@/lib/profile")>()),
  segmentEmails: vi.fn(async () => ["sup@x.com"]),
}));

import { resolveRecipients } from "@/lib/email/audiences";
import { audienceLabel } from "@/lib/email/audienceGroups";

describe("resolveRecipients", () => {
  it("unions, lowercases, and de-dupes volunteers + donors", async () => {
    const r = await resolveRecipients(["volunteers", "donors"]);
    expect(r.recipients.map((x) => x.email).sort()).toEqual(["donor@x.com", "dup@x.com", "vol@x.com"]);
    // Volunteers/donors carry a first name for {{first_name}} personalization.
    expect(r.recipients.find((x) => x.email === "vol@x.com")?.firstName).toBe("Volly");
    expect(r.internal).toBe(false); // external groups
  });

  it("captains pulls only active captain staff and is internal", async () => {
    const r = await resolveRecipients(["captains"]);
    expect(r.recipients.map((x) => x.email)).toEqual(["cap@x.com"]);
    expect(r.recipients[0].firstName).toBeUndefined(); // staff rows carry no name → neutral greeting
    expect(r.internal).toBe(true);
  });

  it("all-team = active admins + captains + members (no partner, no removed)", async () => {
    const r = await resolveRecipients(["team"]);
    expect(r.recipients.map((x) => x.email).sort()).toEqual(["admin@x.com", "cap@x.com", "member@x.com"]);
    expect(r.internal).toBe(true);
  });

  it("mixing a team group with donors is NOT internal", async () => {
    const r = await resolveRecipients(["captains", "donors"]);
    expect(r.internal).toBe(false);
    expect(r.recipients.map((x) => x.email)).toEqual(expect.arrayContaining(["cap@x.com", "donor@x.com"]));
  });

  it("a supporter segment is external (not internal) and adds its emails", async () => {
    const r = await resolveRecipients(["captains"], "way:volunteer");
    expect(r.recipients.map((x) => x.email)).toContain("sup@x.com");
    expect(r.internal).toBe(false);
  });

  it("empty selection → no recipients, not internal", async () => {
    const r = await resolveRecipients([]);
    expect(r.recipients).toEqual([]);
    expect(r.internal).toBe(false);
  });
});

describe("audienceLabel", () => {
  it("joins group labels and appends a segment", () => {
    expect(audienceLabel(["volunteers", "captains"])).toBe("Volunteers + Captains");
    expect(audienceLabel(["team"], "issue:family-courts")).toBe("All-team + issue:family-courts");
    expect(audienceLabel([])).toBe("—");
  });
});
