import { describe, it, expect, vi, beforeEach } from "vitest";

// sendLifecycleText must self-gate: it only sends to a configured + opted-in + non-blocked
// number, adds compliance, and logs to the inbox. Mock the infra; toE164 is faithful.
const smsEnabled = vi.fn();
const sendSms = vi.fn();
const isOptedIn = vi.fn();
const isBlocked = vi.fn();
const logOutbound = vi.fn();

vi.mock("@/lib/sms/send", () => ({
  smsEnabled: () => smsEnabled(),
  sendSms: (...a: unknown[]) => sendSms(...a),
  toE164: (s: string) => {
    const d = String(s).replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d[0] === "1") return `+${d}`;
    return null;
  },
}));
vi.mock("@/lib/sms/consent", () => ({ isOptedIn: (...a: unknown[]) => isOptedIn(...a) }));
vi.mock("@/lib/sms/moderation", () => ({ isBlocked: (...a: unknown[]) => isBlocked(...a) }));
vi.mock("@/lib/sms/conversations", () => ({ logOutbound: (...a: unknown[]) => logOutbound(...a) }));
vi.mock("@/lib/sms/templates", () => ({ withCompliance: (b: string) => `${b} - Paid for by Matt Grant for Congress. Reply STOP to opt out.` }));

import { sendLifecycleText } from "./lifecycle";

beforeEach(() => {
  vi.clearAllMocks();
  smsEnabled.mockResolvedValue(true);
  isOptedIn.mockResolvedValue(true);
  isBlocked.mockResolvedValue(false);
  sendSms.mockResolvedValue({ sent: true, sid: "SM1" });
  logOutbound.mockResolvedValue(undefined);
});

describe("sendLifecycleText", () => {
  it("sends to an opted-in number, adds compliance, and logs to the inbox", async () => {
    const r = await sendLifecycleText({ to: "(314) 555-1234", body: "Thanks for joining!" });
    expect(r.sent).toBe(true);
    expect(sendSms).toHaveBeenCalledWith({ to: "+13145551234", body: expect.stringContaining("Reply STOP to opt out") });
    expect(logOutbound).toHaveBeenCalledWith(expect.objectContaining({ to: "+13145551234", status: "sent" }));
  });

  it("no-ops when texting isn't configured", async () => {
    smsEnabled.mockResolvedValue(false);
    const r = await sendLifecycleText({ to: "+13145551234", body: "hi" });
    expect(r.sent).toBe(false);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("no-ops for a number that isn't opted in (TCPA)", async () => {
    isOptedIn.mockResolvedValue(false);
    const r = await sendLifecycleText({ to: "+13145551234", body: "hi" });
    expect(r.sent).toBe(false);
    expect(r.reason).toMatch(/opted in/i);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("no-ops for a blocked number", async () => {
    isBlocked.mockResolvedValue(true);
    const r = await sendLifecycleText({ to: "+13145551234", body: "hi" });
    expect(r.sent).toBe(false);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("rejects an invalid number without sending", async () => {
    const r = await sendLifecycleText({ to: "nonsense", body: "hi" });
    expect(r.sent).toBe(false);
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("logs a failed send (visible in the thread) and reports it", async () => {
    sendSms.mockResolvedValue({ sent: false, error: "Twilio 30032" });
    const r = await sendLifecycleText({ to: "+13145551234", body: "hi" });
    expect(r.sent).toBe(false);
    expect(logOutbound).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
