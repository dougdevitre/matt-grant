import { describe, it, expect, vi, beforeEach } from "vitest";

// Verify the inbound webhook alerts staff only on the FIRST unread of a FREEFORM
// thread — not on reserved keywords/CTAs, and not on later messages in a burst.
const validateTwilioSignature = vi.fn();
const logInbound = vi.fn();
const notifyStaffInboundText = vi.fn();
const resolveCta = vi.fn();

vi.mock("@/lib/ssm", () => ({ getSecret: vi.fn().mockResolvedValue(undefined) })); // keyword → MATT
vi.mock("@/lib/sms/send", () => ({ validateTwilioSignature: (...a: unknown[]) => validateTwilioSignature(...a) }));
vi.mock("@/lib/sms/consent", () => ({ recordConsent: vi.fn(), recordOptOut: vi.fn() }));
vi.mock("@/lib/volunteers/optout", () => ({ setVolunteerContactOptOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/sms/moderation", () => ({ isBlocked: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/sms/conversations", () => ({ logInbound: (...a: unknown[]) => logInbound(...a) }));
vi.mock("@/lib/notifications/staffNotify", () => ({ notifyStaffInboundText: (...a: unknown[]) => notifyStaffInboundText(...a) }));
vi.mock("@/lib/sms/ctas", () => ({ resolveCta: (...a: unknown[]) => resolveCta(...a), welcomeReply: () => "welcome" }));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { candidate: "Grant", email: "x@y.z" }, SITE_URL: "https://s" }));

import { POST } from "./route";

const req = (body: string) =>
  ({
    formData: async () => {
      const fd = new FormData();
      fd.set("From", "+13145550100");
      fd.set("Body", body);
      fd.set("MessageSid", "SM1");
      return fd;
    },
    headers: { get: () => "" },
    nextUrl: { pathname: "/api/webhooks/twilio" },
  }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  validateTwilioSignature.mockResolvedValue(true);
  resolveCta.mockReturnValue(null);
  logInbound.mockResolvedValue(1);
});

describe("inbound webhook staff alert", () => {
  it("alerts on the first unread of a freeform text", async () => {
    await POST(req("hey can someone call me back"));
    expect(notifyStaffInboundText).toHaveBeenCalledTimes(1);
    expect(notifyStaffInboundText).toHaveBeenCalledWith(
      expect.objectContaining({ from: "+13145550100", bodySnippet: expect.stringContaining("call me back") }),
    );
  });

  it("does NOT alert on a later message in the same unread thread", async () => {
    logInbound.mockResolvedValue(3); // 3rd unread — staff already alerted on the 1st
    await POST(req("still waiting"));
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("does NOT alert on reserved keywords (STOP)", async () => {
    await POST(req("STOP"));
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("does NOT alert on a CTA keyword (DONATE)", async () => {
    resolveCta.mockReturnValue({ source: "sms-cta-donate", reply: "donate link" });
    await POST(req("DONATE"));
    expect(notifyStaffInboundText).not.toHaveBeenCalled();
  });

  it("rejects an invalid Twilio signature with 403 and never logs", async () => {
    validateTwilioSignature.mockResolvedValue(false);
    const res = await POST(req("hello"));
    expect(res.status).toBe(403);
    expect(logInbound).not.toHaveBeenCalled();
  });
});
