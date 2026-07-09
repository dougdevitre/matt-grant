import { describe, it, expect, vi, beforeEach } from "vitest";

// Exercise the self-serve team-text opt-in. Mock the infra + SMS/Clerk helpers;
// isStaff is stubbed via @/lib/auth. toE164 is a faithful stand-in so phone
// normalization + validation is genuinely tested.
const staffGate = vi.fn();
const isStaff = vi.fn();
const recordConsent = vi.fn();
const recordOptOut = vi.fn();
const setClerkPhoneByEmail = vi.fn();
const setVolunteerContactOptOut = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ staffGate: () => staffGate(), isStaff: (g: unknown) => isStaff(g) }));
vi.mock("@/lib/notifications/types", () => ({ isNotificationType: () => true }));
vi.mock("@/lib/notifications/prefs", () => ({ setMutedNotifications: vi.fn() }));
vi.mock("@/lib/sms/send", () => ({
  toE164: (s: string) => {
    const d = String(s).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d[0] === "1") return `+${d}`;
    return null;
  },
}));
vi.mock("@/lib/sms/consent", () => ({
  recordConsent: (...a: unknown[]) => recordConsent(...a),
  recordOptOut: (...a: unknown[]) => recordOptOut(...a),
}));
vi.mock("@/lib/clerkRoles", () => ({ setClerkPhoneByEmail: (...a: unknown[]) => setClerkPhoneByEmail(...a) }));
vi.mock("@/lib/volunteers/optout", () => ({ setVolunteerContactOptOut: (...a: unknown[]) => setVolunteerContactOptOut(...a) }));

import { saveTextAlerts } from "./actions";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.clearAllMocks();
  staffGate.mockResolvedValue({ ok: true, role: "captain", email: "cap@x.test" });
  isStaff.mockReturnValue(true);
  recordConsent.mockResolvedValue(true);
  recordOptOut.mockResolvedValue(true);
  setVolunteerContactOptOut.mockResolvedValue(undefined);
});

describe("saveTextAlerts", () => {
  it("records opt-in consent with the staff-optin source and stores the number", async () => {
    const res = await saveTextAlerts(form({ phone: "(314) 555-1234", optIn: "true" }));
    expect(res.ok).toBe(true);
    expect(setClerkPhoneByEmail).toHaveBeenCalledWith("cap@x.test", "+13145551234");
    expect(recordConsent).toHaveBeenCalledWith("+13145551234", "staff-optin");
    expect(setVolunteerContactOptOut).toHaveBeenCalledWith({ phone: "+13145551234" }, false);
    expect(recordOptOut).not.toHaveBeenCalled();
  });

  it("opts out (and mirrors the roster) when the box is unchecked", async () => {
    const res = await saveTextAlerts(form({ phone: "+13145551234", optIn: "false" }));
    expect(res.ok).toBe(true);
    expect(recordOptOut).toHaveBeenCalledWith("+13145551234");
    expect(setVolunteerContactOptOut).toHaveBeenCalledWith({ phone: "+13145551234" }, true);
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("rejects an invalid number without recording consent", async () => {
    const res = await saveTextAlerts(form({ phone: "nonsense", optIn: "true" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/valid US mobile/i);
    expect(recordConsent).not.toHaveBeenCalled();
    expect(setClerkPhoneByEmail).not.toHaveBeenCalled();
  });

  it("refuses a non-staff caller and never touches consent", async () => {
    isStaff.mockReturnValue(false);
    const res = await saveTextAlerts(form({ phone: "+13145551234", optIn: "true" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/not signed in/i);
    expect(recordConsent).not.toHaveBeenCalled();
  });

  it("surfaces a DB failure on opt-in as an error", async () => {
    recordConsent.mockResolvedValue(false);
    const res = await saveTextAlerts(form({ phone: "+13145551234", optIn: "true" }));
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/database isn't reachable/i);
  });
});
