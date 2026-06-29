import { describe, it, expect, vi, beforeEach } from "vitest";

// Verify role-targeted staff notifications resolve the right recipients (staff store + env
// allowlist for admins), and are strictly best-effort (a send failure never throws).
const sendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), sesEnabled: true }));
const listStaff = vi.fn();
vi.mock("@/lib/staff", () => ({ listStaff: () => listStaff() }));
vi.mock("@/lib/auth", () => ({ STAFF_ALLOWLIST: ["boss@x.com"] }));
const emailsMuting = vi.fn();
vi.mock("@/lib/notifications/prefs", () => ({ emailsMuting: (...a: unknown[]) => emailsMuting(...a) }));

import {
  notifyModeratorsNewIssue,
  notifyCaptainsNewVolunteer,
  notifyAdminsNewDonation,
  notifyAdminsCaptainApplication,
  notifyCaptainVolunteerInterest,
  sendRoleWelcome,
} from "./staffNotify";

const STAFF = [
  { email: "Admin@x.com", role: "admin", status: "active" },
  { email: "cap@x.com", role: "captain", status: "active" },
  { email: "vol@x.com", role: "volunteer", status: "active" },
  { email: "old@x.com", role: "captain", status: "removed" },
];

const toOf = (i = 0) => {
  const arg = sendEmail.mock.calls[i][0] as { to: string | string[] };
  return (Array.isArray(arg.to) ? arg.to : [arg.to]).sort();
};

beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue({ sent: true });
  listStaff.mockReset().mockResolvedValue(STAFF);
  emailsMuting.mockReset().mockResolvedValue(new Set()); // nobody opted out by default
});

describe("role-targeted staff notifications", () => {
  it("moderator alert → active admins + captains + allowlist admin (not volunteers/removed)", async () => {
    await notifyModeratorsNewIssue({ topic: "Potholes on Main", name: "Sam", city: "St. Charles" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(toOf()).toEqual(["admin@x.com", "boss@x.com", "cap@x.com"]);
  });

  it("volunteer alert → captains only (no allowlist, no admins)", async () => {
    await notifyCaptainsNewVolunteer({ name: "Dana", email: "dana@x.com", interests: "knock" });
    expect(toOf()).toEqual(["cap@x.com"]);
  });

  it("donation alert → admins + allowlist admin", async () => {
    await notifyAdminsNewDonation({ name: "Pat", amount: 50, email: "pat@x.com" });
    expect(toOf()).toEqual(["admin@x.com", "boss@x.com"]);
    expect((sendEmail.mock.calls[0][0] as { subject: string }).subject).toContain("$50.00");
  });

  it("captain application → admins + allowlist admin (not captains/volunteers)", async () => {
    await notifyAdminsCaptainApplication({ name: "Lee", email: "lee@x.com", city: "Kirkwood", note: "I run our PTA." });
    expect(emailsMuting).toHaveBeenCalledWith("captain_application");
    expect(toOf()).toEqual(["admin@x.com", "boss@x.com"]);
    expect((sendEmail.mock.calls[0][0] as { subject: string }).subject).toContain("Lee");
  });

  it("captain interest ping → the one captain, subject names the task", async () => {
    await notifyCaptainVolunteerInterest("cap@x.com", { name: "Dana", email: "dana@x.com", task: "Knock doors" });
    const arg = sendEmail.mock.calls[0][0] as { to: string; subject: string };
    expect(arg.to).toBe("cap@x.com");
    expect(arg.subject).toContain("Knock doors");
    expect(arg.subject).toContain("Dana");
  });

  it("captain interest ping → no-op without a captain email", async () => {
    await notifyCaptainVolunteerInterest("", { task: "Knock doors" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("role welcome → the staffer, subject names the role", async () => {
    await sendRoleWelcome("new@x.com", "captain", "Jordan");
    const arg = sendEmail.mock.calls[0][0] as { to: string; subject: string };
    expect(arg.to).toBe("new@x.com");
    expect(arg.subject).toContain("Captain");
  });

  it("no recipients → no send", async () => {
    listStaff.mockResolvedValue([]); // no captains, and captain notify doesn't use the allowlist
    await notifyCaptainsNewVolunteer({ name: "X" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("drops a recipient who opted out of that notification type", async () => {
    emailsMuting.mockResolvedValue(new Set(["cap@x.com"])); // captain muted issue_moderation
    await notifyModeratorsNewIssue({ topic: "x" });
    expect(emailsMuting).toHaveBeenCalledWith("issue_moderation");
    expect(toOf()).toEqual(["admin@x.com", "boss@x.com"]); // captain filtered out
  });

  it("does not send when every recipient has opted out", async () => {
    emailsMuting.mockResolvedValue(new Set(["cap@x.com"]));
    await notifyCaptainsNewVolunteer({ name: "Dana" }); // only captain is a recipient
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("best-effort: a send failure does not throw", async () => {
    sendEmail.mockRejectedValue(new Error("SES down"));
    await expect(notifyModeratorsNewIssue({ topic: "x" })).resolves.toBeUndefined();
  });

  it("resilient to a staff-store error (admin alert still uses the allowlist)", async () => {
    listStaff.mockRejectedValue(new Error("ddb down"));
    await notifyAdminsNewDonation({ amount: 10 });
    expect(toOf()).toEqual(["boss@x.com"]);
  });
});
