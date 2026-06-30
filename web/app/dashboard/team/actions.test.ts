import { describe, it, expect, vi, beforeEach } from "vitest";

// Exercise resendInviteAction with @/lib/rbac REAL so the admin capability gate is
// genuinely enforced. resendInvite, the audit log, email config, and revalidation
// are mocked so we assert orchestration: who's allowed, what gets logged, and that
// already-accepted people are never emailed or logged.
const staffGate = vi.fn();
const resendInvite = vi.fn();
const recordAccessChange = vi.fn();
const ses = vi.hoisted(() => ({ enabled: true }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate() }));
vi.mock("@/lib/invites", () => ({
  resendInvite: (...a: unknown[]) => resendInvite(...a),
  remindPendingInvites: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ recordAccessChange: (...a: unknown[]) => recordAccessChange(...a) }));
vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(),
  get sesEnabled() {
    return ses.enabled;
  },
}));
vi.mock("@/lib/email/layout", () => ({ renderEmail: vi.fn(), renderText: vi.fn() }));
vi.mock("@/lib/staff", () => ({
  addStaff: vi.fn(),
  removeStaff: vi.fn(),
  setStaffRole: vi.fn(),
  staffRole: vi.fn(),
  setCaptainArea: vi.fn(),
  setCaptainRegions: vi.fn(),
}));
vi.mock("@/lib/clerkRoles", () => ({
  inviteToClerk: vi.fn(),
  setClerkRoleByEmail: vi.fn(),
  clearClerkRoleByEmail: vi.fn(),
}));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://example.test" }));

import { resendInviteAction, promoteToCaptain, setCaptainAreaAction, setCaptainRegionsAction } from "./actions";
import { addStaff, staffRole, setCaptainArea, setCaptainRegions } from "@/lib/staff";
import { setClerkRoleByEmail } from "@/lib/clerkRoles";

const form = (email: string) => {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  ses.enabled = true;
  staffGate.mockResolvedValue({ ok: true, role: "admin", email: "admin@x.test" });
});

describe("resendInviteAction", () => {
  it("refuses a non-admin role", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "volunteer", email: "vol@x.test" });
    await expect(resendInviteAction(null, form("pending@x.test"))).rejects.toThrow(/forbidden/i);
    expect(resendInvite).not.toHaveBeenCalled();
  });

  it("validates the email", async () => {
    const res = await resendInviteAction(null, form("not-an-email"));
    expect(res.ok).toBe(false);
    expect(resendInvite).not.toHaveBeenCalled();
  });

  it("reports when email isn't configured", async () => {
    ses.enabled = false;
    const res = await resendInviteAction(null, form("pending@x.test"));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/configured/i);
    expect(resendInvite).not.toHaveBeenCalled();
  });

  it("resends to a pending invitee and logs an invite_reminder audit entry", async () => {
    resendInvite.mockResolvedValue({ ok: true });
    const res = await resendInviteAction(null, form("Pending@X.test"));
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/reminder sent/i);
    expect(resendInvite).toHaveBeenCalledWith("pending@x.test"); // normalized
    expect(recordAccessChange).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite_reminder", target: "pending@x.test", actor: "admin@x.test" }),
    );
  });

  it("does not email or log someone who already accepted", async () => {
    resendInvite.mockResolvedValue({ ok: false, reason: "not_pending" });
    const res = await resendInviteAction(null, form("accepted@x.test"));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/already accepted/i);
    expect(recordAccessChange).not.toHaveBeenCalled();
  });
});

describe("promoteToCaptain", () => {
  it("refuses a non-admin (captains can't mint captains)", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "captain", email: "cap@x.test" });
    await expect(promoteToCaptain(form("v@x.test"))).rejects.toThrow(/forbidden/i);
    expect(addStaff).not.toHaveBeenCalled();
  });

  it("promotes a volunteer: staff row + Clerk role + audit", async () => {
    vi.mocked(staffRole).mockResolvedValue(null);
    await promoteToCaptain(form("v@x.test"));
    expect(addStaff).toHaveBeenCalledWith("v@x.test", undefined, "captain", "admin@x.test");
    expect(setClerkRoleByEmail).toHaveBeenCalledWith("v@x.test", "captain");
    expect(recordAccessChange).toHaveBeenCalled();
  });

  it("is a no-op when already a captain", async () => {
    vi.mocked(staffRole).mockResolvedValue("captain");
    await promoteToCaptain(form("v@x.test"));
    expect(addStaff).not.toHaveBeenCalled();
    expect(setClerkRoleByEmail).not.toHaveBeenCalled();
  });
});

describe("setCaptainAreaAction", () => {
  it("refuses a non-admin", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "captain", email: "cap@x.test" });
    const fd = new FormData();
    fd.set("email", "c@x.test");
    fd.set("area", "63101");
    await expect(setCaptainAreaAction(fd)).rejects.toThrow(/forbidden/i);
    expect(setCaptainArea).not.toHaveBeenCalled();
  });

  it("saves the area for an admin", async () => {
    const fd = new FormData();
    fd.set("email", "C@x.test");
    fd.set("area", "Kirkwood");
    await setCaptainAreaAction(fd);
    expect(setCaptainArea).toHaveBeenCalledWith("c@x.test", "Kirkwood");
  });
});

describe("setCaptainRegionsAction", () => {
  it("refuses a non-admin", async () => {
    staffGate.mockResolvedValue({ ok: true, role: "captain", email: "cap@x.test" });
    const fd = new FormData();
    fd.set("email", "c@x.test");
    fd.append("region", "St. Louis County");
    await expect(setCaptainRegionsAction(fd)).rejects.toThrow(/forbidden/i);
    expect(setCaptainRegions).not.toHaveBeenCalled();
  });

  it("saves the selected regions for an admin", async () => {
    const fd = new FormData();
    fd.set("email", "C@x.test");
    fd.append("region", "St. Louis County");
    fd.append("region", "Jefferson County");
    await setCaptainRegionsAction(fd);
    expect(setCaptainRegions).toHaveBeenCalledWith("c@x.test", ["St. Louis County", "Jefferson County"]);
  });

  it("passes an empty list (clear) when nothing is selected", async () => {
    const fd = new FormData();
    fd.set("email", "c@x.test");
    await setCaptainRegionsAction(fd);
    expect(setCaptainRegions).toHaveBeenCalledWith("c@x.test", []);
  });
});
