import { describe, it, expect, vi } from "vitest";

// Cross-cutting compliance invariants that must hold no matter HOW the audience is assembled
// (data-record groups + Clerk roles + segments, combined). The per-module tests cover each source;
// this locks the holistic safety properties so a future change to one path can't break them.

// --- shared mocks (cover both the email + sms resolvers) ---
vi.mock("@/lib/clerkAudiences", () => ({
  // Every role resolves to one opted-in-capable contact (phone +1A is opted in below).
  listClerkContactsByRole: async () => [{ email: "role@x.com", phone: "+1A", firstName: "R" }],
}));
// email deps
vi.mock("@/lib/queries", () => ({
  getVolunteers: async () => ({ rows: [{ name: "V", email: "vol@x.com", phone: "+1C" }] }),
  getDonors: async () => ({ rows: [] }),
}));
vi.mock("@/lib/staff", () => ({ listStaff: async () => [{ email: "cap@x.com", role: "captain", status: "active" }] }));
vi.mock("@/lib/profile", () => ({ segmentEmails: async () => ["seg@x.com"], isWayToHelp: () => false }));
vi.mock("@/lib/integrations/research/issues", () => ({ isIssueId: (s: string) => s === "x" }));
// sms deps
vi.mock("@/lib/sms/consent", () => ({ optedInSet: async () => new Set(["+1A", "+1B"]) }));
vi.mock("@/lib/sms/moderation", () => ({ listBlocked: async () => [{ phone: "+1B" }] }));
vi.mock("@/lib/sms/send", () => ({ toE164: (p: string) => (p?.startsWith("+") ? p : null) }));

import { resolveRecipients } from "@/lib/email/audiences";
import { resolveSmsRecipients } from "@/lib/sms/audiences";

describe("SMS invariant: never emit a non-opted-in or blocked number", () => {
  const OPTED = new Set(["+1A", "+1B"]);
  const BLOCKED = new Set(["+1B"]);

  it("holds across subscribers + volunteers + roles combined", async () => {
    const out = await resolveSmsRecipients(["subscribers", "volunteers"], ["admin", "donor"]);
    // Every recipient is opted in AND not blocked — by construction.
    for (const p of out) {
      expect(OPTED.has(p), `${p} must be opted in`).toBe(true);
      expect(BLOCKED.has(p), `${p} must not be blocked`).toBe(false);
    }
    // +1B (blocked), +1C (volunteer, not opted), +1D-style role nums (not opted) are all excluded.
    expect(out).toEqual(["+1A"]);
  });
});

describe("Email invariant: `internal` (bypass topic opt-outs) only for all-staff sends", () => {
  it("staff group + staff role, no segment → internal", async () => {
    expect((await resolveRecipients(["captains"], undefined, ["volunteer"])).internal).toBe(true);
  });

  it("any external role flips it to external", async () => {
    expect((await resolveRecipients(["captains"], undefined, ["donor"])).internal).toBe(false);
  });

  it("any external segment flips it to external (and adds its emails)", async () => {
    const { internal, recipients } = await resolveRecipients(["captains"], "issue:x", ["volunteer"]);
    expect(internal).toBe(false);
    expect(recipients.map((r) => r.email)).toContain("seg@x.com");
  });

  it("an external data-group (donors-style via volunteers) is external", async () => {
    expect((await resolveRecipients(["volunteers"], undefined, [])).internal).toBe(false);
  });
});
