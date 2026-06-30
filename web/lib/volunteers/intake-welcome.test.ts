import { describe, it, expect, vi, beforeEach } from "vitest";

// Focused coverage of the welcome idempotency guard (the rest of saveVolunteerSignup
// is covered in intake.test.ts). Here SES is ON so the joiner welcome actually
// sends, and we drive the DynamoDB conditional claim + Clerk welcomedAt flag.
vi.mock("server-only", () => ({}));

const send = vi.fn();
vi.mock("@/lib/db", () => ({
  ddb: { send: (c: unknown) => send(c) },
  TABLE: "T",
  PK: { volunteers: "VOL" },
  newId: () => "rand-id",
  dbConfigured: true,
}));
const sendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a), sesEnabled: true }));
vi.mock("@/lib/email/templates", () => ({
  volunteerWelcome: () => ({ subject: "vol", html: "h", text: "t" }),
  supporterWelcome: () => ({ subject: "sup", html: "h", text: "t" }),
  contactReceipt: () => ({ subject: "rec", html: "h", text: "t" }),
}));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { email: "campaign@x.com" } }));
vi.mock("@/lib/sms/send", () => ({ toE164: (p: string) => (p ? `+1${p.replace(/\D/g, "")}` : null) }));
vi.mock("@/lib/sms/consent", () => ({ recordConsent: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/profile", () => ({
  saveProfile: vi.fn().mockResolvedValue(undefined),
  cleanZip: (z?: string | null) => (z && /^\d{5}/.test(z) ? z.slice(0, 5) : undefined),
}));
vi.mock("@/lib/volunteers/airtable", () => ({ mirrorVolunteerToAirtable: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/notifications/staffNotify", () => ({
  notifyAdminsCaptainApplication: vi.fn().mockResolvedValue(undefined),
  notifyCaptainsNewVolunteer: vi.fn().mockResolvedValue(undefined),
}));

// Clerk client mock — getUserList returns the user with a tunable welcomedAt flag.
const clerkWelcomedAt = { value: undefined as string | undefined };
const updateUserMetadata = vi.fn().mockResolvedValue(undefined);
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUserList: async () => ({ data: [{ id: "user_1", privateMetadata: { welcomedAt: clerkWelcomedAt.value } }] }),
      updateUserMetadata: (...a: unknown[]) => updateUserMetadata(...a),
    },
  }),
}));

import { saveVolunteerSignup } from "./intake";

// Drive the conditional welcome claim: the claim is the UpdateCommand carrying a
// ConditionExpression. `claimSucceeds` decides whether it resolves or rejects.
function wireDynamo(claimSucceeds: boolean) {
  send.mockImplementation((cmd: { input?: Record<string, unknown> }) => {
    if (cmd.input?.ConditionExpression) {
      return claimSucceeds ? Promise.resolve({}) : Promise.reject(new Error("ConditionalCheckFailed"));
    }
    return Promise.resolve({ Attributes: {} });
  });
}

const welcomeSends = () => sendEmail.mock.calls.filter((c) => c[0]?.to === "v@x.com");

beforeEach(() => {
  send.mockReset();
  sendEmail.mockReset().mockResolvedValue({ sent: true });
  updateUserMetadata.mockReset().mockResolvedValue(undefined);
  clerkWelcomedAt.value = undefined;
});

describe("welcome idempotency", () => {
  const signup = { name: "Val Volunteer", email: "v@x.com", door: "Volunteer" as const };

  it("welcomes the joiner once on a first signup and stamps the Clerk flag", async () => {
    wireDynamo(true); // claim succeeds → first time
    await saveVolunteerSignup(signup);
    expect(welcomeSends()).toHaveLength(1);
    expect(updateUserMetadata).toHaveBeenCalledWith("user_1", { privateMetadata: { welcomedAt: expect.any(String) } });
  });

  it("does NOT re-welcome on a re-submit (claim fails)", async () => {
    wireDynamo(false); // welcomedAt already set → claim rejected
    await saveVolunteerSignup(signup);
    expect(welcomeSends()).toHaveLength(0);
    expect(updateUserMetadata).not.toHaveBeenCalled();
  });

  it("skips its welcome when the Clerk webhook already welcomed this email", async () => {
    wireDynamo(true); // we win the DB claim…
    clerkWelcomedAt.value = "2026-06-01T00:00:00Z"; // …but Clerk already welcomed
    await saveVolunteerSignup(signup);
    expect(welcomeSends()).toHaveLength(0);
  });

  it("still sends the internal campaign-inbox copy regardless", async () => {
    wireDynamo(false); // no joiner welcome
    await saveVolunteerSignup(signup);
    expect(sendEmail.mock.calls.some((c) => c[0]?.to === "campaign@x.com")).toBe(true);
  });
});
