import { describe, it, expect, vi, beforeEach } from "vitest";

// saveVolunteerSignup is the single write path for every /join door. Verify: input
// validation, the dedupe key (email vs phone), the Airtable upsert + id persistence,
// door-targeted staff alerts, and the supporter-profile waysToHelp mapping. The DB,
// Airtable mirror, email, SMS, and notifications are all mocked.
vi.mock("server-only", () => ({}));

const send = vi.fn();
vi.mock("@/lib/db", () => ({
  ddb: { send: (c: unknown) => send(c) },
  TABLE: "T",
  PK: { volunteers: "VOL" },
  newId: () => "rand-id",
  dbConfigured: true,
}));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn(), sesEnabled: false }));
vi.mock("@/lib/email/templates", () => ({
  volunteerWelcome: () => ({ subject: "", html: "", text: "" }),
  supporterWelcome: () => ({ subject: "", html: "", text: "" }),
  contactReceipt: () => ({ subject: "", html: "", text: "" }),
}));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { email: "campaign@x.com" } }));
vi.mock("@/lib/sms/send", () => ({ toE164: (p: string) => (p ? `+1${p.replace(/\D/g, "")}` : null) }));
const recordConsent = vi.fn();
vi.mock("@/lib/sms/consent", () => ({ recordConsent: (...a: unknown[]) => recordConsent(...a) }));
const saveProfile = vi.fn();
vi.mock("@/lib/profile", () => ({
  saveProfile: (...a: unknown[]) => saveProfile(...a),
  cleanZip: (z?: string | null) => (z && /^\d{5}/.test(z) ? z.slice(0, 5) : undefined),
}));
const mirrorVolunteerToAirtable = vi.fn();
vi.mock("@/lib/volunteers/airtable", () => ({
  mirrorVolunteerToAirtable: (...a: unknown[]) => mirrorVolunteerToAirtable(...a),
}));
const notifyAdminsCaptainApplication = vi.fn();
const notifyCaptainsNewVolunteer = vi.fn();
vi.mock("@/lib/notifications/staffNotify", () => ({
  notifyAdminsCaptainApplication: (...a: unknown[]) => notifyAdminsCaptainApplication(...a),
  notifyCaptainsNewVolunteer: (...a: unknown[]) => notifyCaptainsNewVolunteer(...a),
}));

import { saveVolunteerSignup } from "./intake";

// The DynamoDB command object exposes its args on `.input`.
const inputOf = (i = 0) => (send.mock.calls[i][0] as { input: Record<string, unknown> }).input;

beforeEach(() => {
  send.mockReset().mockResolvedValue({ Attributes: {} }); // no pre-existing airtableId
  recordConsent.mockReset().mockResolvedValue(true);
  saveProfile.mockReset().mockResolvedValue(undefined);
  mirrorVolunteerToAirtable.mockReset().mockResolvedValue("recNEW");
  notifyAdminsCaptainApplication.mockReset().mockResolvedValue(undefined);
  notifyCaptainsNewVolunteer.mockReset().mockResolvedValue(undefined);
});

describe("validation", () => {
  it("rejects a missing name", async () => {
    const r = await saveVolunteerSignup({ name: "", email: "a@b.com", door: "Get Updates" });
    expect(r.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects when neither email nor phone is given", async () => {
    const r = await saveVolunteerSignup({ name: "Dana", door: "Get Updates" });
    expect(r.ok).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("dedupe key", () => {
  it("keys on email when present", async () => {
    await saveVolunteerSignup({ name: "Dana", email: "Dana@X.com", door: "Volunteer" });
    expect((inputOf(0).Key as { SK: string }).SK).toBe("e:dana@x.com");
    expect(inputOf(0).ReturnValues).toBe("ALL_NEW");
  });

  it("keys on phone when no email", async () => {
    await saveVolunteerSignup({ name: "Dana", phone: "(314) 555-0123", door: "Volunteer" });
    expect((inputOf(0).Key as { SK: string }).SK).toBe("p:3145550123");
  });
});

describe("Airtable upsert + id persistence", () => {
  it("CREATEs (no existing id) then persists the returned Airtable id", async () => {
    await saveVolunteerSignup({ name: "Dana", email: "d@x.com", door: "Volunteer" });
    expect(mirrorVolunteerToAirtable).toHaveBeenCalledWith(expect.objectContaining({ door: "Volunteer" }), null);
    // second DynamoDB write persists airtableId
    const persist = inputOf(1);
    expect(persist.UpdateExpression).toContain("airtableId");
    expect((persist.ExpressionAttributeValues as Record<string, unknown>)[":aid"]).toBe("recNEW");
  });

  it("UPDATEs the existing row (passes stored id) and does NOT re-persist", async () => {
    send.mockResolvedValueOnce({ Attributes: { airtableId: "recOLD" } });
    mirrorVolunteerToAirtable.mockResolvedValue("recOLD");
    await saveVolunteerSignup({ name: "Dana", email: "d@x.com", door: "Volunteer" });
    expect(mirrorVolunteerToAirtable).toHaveBeenCalledWith(expect.anything(), "recOLD");
    expect(send).toHaveBeenCalledTimes(1); // no second persist write
  });
});

describe("door-targeted staff alerts + profile", () => {
  it("Team Captain → alerts admins, not captains", async () => {
    await saveVolunteerSignup({ name: "Lee", email: "lee@x.com", door: "Team Captain", captainNote: "PTA" });
    expect(notifyAdminsCaptainApplication).toHaveBeenCalledOnce();
    expect(notifyCaptainsNewVolunteer).not.toHaveBeenCalled();
  });

  it("Volunteer → alerts captains, not admins", async () => {
    await saveVolunteerSignup({ name: "Dana", email: "d@x.com", door: "Volunteer" });
    expect(notifyCaptainsNewVolunteer).toHaveBeenCalledOnce();
    expect(notifyAdminsCaptainApplication).not.toHaveBeenCalled();
  });

  it("maps the door to a waysToHelp profile flag", async () => {
    await saveVolunteerSignup({ name: "Dana", email: "d@x.com", door: "Volunteer" });
    expect(saveProfile).toHaveBeenCalledWith(
      "d@x.com",
      expect.objectContaining({ waysToHelp: expect.arrayContaining(["volunteer"]) }),
    );
  });

  it("records SMS consent only on explicit opt-in with a phone", async () => {
    await saveVolunteerSignup({ name: "Dana", phone: "3145550123", door: "Get Updates", smsOptIn: true });
    expect(recordConsent).toHaveBeenCalledWith("+13145550123", "join-form");
  });
});
