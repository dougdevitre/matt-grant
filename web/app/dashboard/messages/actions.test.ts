import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the infra + SMS helpers; keep @/lib/rbac REAL so the capability gate is
// genuinely exercised. toE164 is a faithful stand-in so normalization + dedup
// of the selected numbers is actually tested.
const staffGate = vi.fn();
const archiveConversation = vi.fn();
const markRead = vi.fn();
const blockNumber = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/db", () => ({ ddb: { send: vi.fn() }, TABLE: "t", PK: { volunteers: "VOL" } }));
vi.mock("@/lib/sms/send", () => ({
  smsEnabled: vi.fn().mockResolvedValue(true),
  toE164: (s: string) => {
    const d = String(s).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d[0] === "1") return `+${d}`;
    return null;
  },
}));
vi.mock("@/lib/sms/conversations", () => ({
  archiveConversation: (...a: unknown[]) => archiveConversation(...a),
  markRead: (...a: unknown[]) => markRead(...a),
  sendDirectMessage: vi.fn(),
  linkConversationEmail: vi.fn(),
}));
vi.mock("@/lib/sms/moderation", () => ({ blockNumber: (...a: unknown[]) => blockNumber(...a), unblockNumber: vi.fn() }));
vi.mock("@/lib/clerkRoles", () => ({ inviteToClerk: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(), sesEnabled: false }));
vi.mock("@/lib/email/layout", () => ({ renderEmail: vi.fn(), renderText: vi.fn() }));

import { bulkConversationAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  staffGate.mockResolvedValue({ ok: true, role: "admin", email: "a@x.test" });
});

describe("bulkConversationAction", () => {
  it("archives each selected conversation and reports the count", async () => {
    const res = await bulkConversationAction(["+13145551234", "+13145559999"], "archive");
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/2 conversations archived/);
    expect(archiveConversation).toHaveBeenCalledTimes(2);
    expect(archiveConversation).toHaveBeenCalledWith("+13145551234", true);
    expect(markRead).not.toHaveBeenCalled();
    expect(blockNumber).not.toHaveBeenCalled();
  });

  it("marks read via the existing per-conversation helper", async () => {
    await bulkConversationAction(["+13145551234"], "markRead");
    expect(markRead).toHaveBeenCalledExactlyOnceWith("+13145551234");
    expect(archiveConversation).not.toHaveBeenCalled();
  });

  it("blocks each number, passing the actor + a reason", async () => {
    await bulkConversationAction(["+13145551234"], "block");
    expect(blockNumber).toHaveBeenCalledExactlyOnceWith({ phone: "+13145551234", by: "a@x.test", reason: "Bulk block from inbox" });
  });

  it("normalizes + dedupes numbers and drops invalid ones", async () => {
    // Two formats of the same number + one junk value → one archive call.
    const res = await bulkConversationAction(["3145551234", "(314) 555-1234", "nonsense"], "archive");
    expect(res.ok).toBe(true);
    expect(archiveConversation).toHaveBeenCalledExactlyOnceWith("+13145551234", true);
  });

  it("no-ops on an empty / all-invalid selection", async () => {
    const res = await bulkConversationAction(["nonsense"], "archive");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/select at least one/i);
    expect(archiveConversation).not.toHaveBeenCalled();
  });

  it("refuses a role lacking messageIndividuals and never touches a conversation", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "partner", email: "p@x.test" });
    const res = await bulkConversationAction(["+13145551234"], "block");
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not allowed/i);
    expect(blockNumber).not.toHaveBeenCalled();
  });
});
