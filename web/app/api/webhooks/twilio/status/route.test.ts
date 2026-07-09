import { describe, it, expect, vi, beforeEach } from "vitest";

// The Twilio status callback verifies the signature, then reflects a terminal delivery
// status onto the matching 1:1 thread message. Non-terminal states and unknown SIDs no-op.
const validateTwilioSignature = vi.fn();
const updateMessageStatusBySid = vi.fn();

vi.mock("@/lib/sms/send", () => ({ validateTwilioSignature: (...a: unknown[]) => validateTwilioSignature(...a) }));
vi.mock("@/lib/sms/conversations", () => ({ updateMessageStatusBySid: (...a: unknown[]) => updateMessageStatusBySid(...a) }));

import { POST } from "./route";

const req = (params: Record<string, string>) =>
  ({
    formData: async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(params)) fd.set(k, v);
      return fd;
    },
    headers: { get: () => "" },
    nextUrl: { pathname: "/api/webhooks/twilio/status" },
  }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  validateTwilioSignature.mockResolvedValue(true);
  updateMessageStatusBySid.mockResolvedValue(true);
});

describe("twilio status callback", () => {
  it("reflects a delivered receipt on the thread message", async () => {
    const res = await POST(req({ MessageSid: "SM1", MessageStatus: "delivered", To: "+13145550100" }));
    expect(res.status).toBe(204);
    expect(updateMessageStatusBySid).toHaveBeenCalledWith("+13145550100", "SM1", "delivered");
  });

  it("persists 'failed' too", async () => {
    await POST(req({ MessageSid: "SM2", MessageStatus: "failed", To: "+13145550100" }));
    expect(updateMessageStatusBySid).toHaveBeenCalledWith("+13145550100", "SM2", "failed");
  });

  it("ignores non-terminal states (queued/sent)", async () => {
    await POST(req({ MessageSid: "SM3", MessageStatus: "sent", To: "+13145550100" }));
    expect(updateMessageStatusBySid).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 403 and never writes", async () => {
    validateTwilioSignature.mockResolvedValue(false);
    const res = await POST(req({ MessageSid: "SM4", MessageStatus: "delivered", To: "+13145550100" }));
    expect(res.status).toBe(403);
    expect(updateMessageStatusBySid).not.toHaveBeenCalled();
  });
});
