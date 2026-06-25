import { describe, it, expect, vi, beforeEach } from "vitest";

// resendInvite() joins against Clerk's pending list (the source of truth for
// "not yet accepted") and only emails people who are still pending. Clerk + SES are
// mocked so we assert: a pending invitee gets the branded reminder + a ledger write,
// and someone who isn't pending (already accepted) is never emailed.
const getInvitationList = vi.fn();
const sendEmail = vi.fn();
const ddbSend = vi.fn();

vi.mock("@/lib/auth", () => ({ clerkEnabled: true }));
vi.mock("@/lib/email/send", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), sesEnabled: true }));
vi.mock("@/lib/email/templates", () => ({
  inviteReminder: (o: { firstName?: string; acceptUrl: string }) => ({
    subject: "subj",
    html: `html:${o.acceptUrl}`,
    text: `text:${o.acceptUrl}`,
  }),
}));
vi.mock("@/lib/db", () => ({
  ddb: { send: (...a: unknown[]) => ddbSend(...a) },
  TABLE: "t",
  PK: { inviteReminders: "INVITEREMINDER" },
  dbConfigured: true,
}));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://example.test" }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ invitations: { getInvitationList } }),
}));

import { resendInvite } from "./invites";

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue({ sent: true });
  ddbSend.mockResolvedValue({}); // markReminded write + recentlyReminded read both no-op OK
});

describe("resendInvite", () => {
  it("emails a still-pending invitee and records the reminder", async () => {
    getInvitationList.mockResolvedValue({
      data: [{ emailAddress: "Pending@X.test", url: "https://clerk/accept", createdAt: 1, publicMetadata: { role: "volunteer" } }],
    });

    const res = await resendInvite("pending@x.test");

    expect(res.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "pending@x.test", html: "html:https://clerk/accept" }),
    );
    // markReminded writes to the INVITEREMINDER ledger
    expect(ddbSend).toHaveBeenCalled();
  });

  it("does not email someone who is no longer pending (already accepted)", async () => {
    getInvitationList.mockResolvedValue({ data: [{ emailAddress: "someone-else@x.test", createdAt: 1 }] });

    const res = await resendInvite("accepted@x.test");

    expect(res).toEqual({ ok: false, reason: "not_pending" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
