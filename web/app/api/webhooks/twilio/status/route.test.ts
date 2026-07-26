import { describe, it, expect, vi, beforeEach } from "vitest";

// The Twilio status callback verifies the signature, then reflects a terminal delivery
// status onto the matching 1:1 thread message. Non-terminal states and unknown SIDs no-op.
// Broadcast sends have no thread row, so they carry a ?c=<campaign key> param and are
// tallied on the campaign instead — that param is also part of the signed URL.
const validateTwilioSignature = vi.fn();
const updateMessageStatusBySid = vi.fn();
const recordCampaignDelivery = vi.fn();

vi.mock("@/lib/sms/send", () => ({ validateTwilioSignature: (...a: unknown[]) => validateTwilioSignature(...a) }));
vi.mock("@/lib/sms/conversations", () => ({ updateMessageStatusBySid: (...a: unknown[]) => updateMessageStatusBySid(...a) }));
vi.mock("@/lib/sms/campaigns", () => ({ recordCampaignDelivery: (...a: unknown[]) => recordCampaignDelivery(...a) }));

import { POST } from "./route";

const req = (params: Record<string, string>, search = "") =>
  ({
    formData: async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(params)) fd.set(k, v);
      return fd;
    },
    headers: { get: () => "" },
    nextUrl: {
      pathname: "/api/webhooks/twilio/status",
      search,
      searchParams: new URLSearchParams(search),
    },
  }) as unknown as Parameters<typeof POST>[0];

beforeEach(() => {
  vi.clearAllMocks();
  validateTwilioSignature.mockResolvedValue(true);
  updateMessageStatusBySid.mockResolvedValue(true);
  recordCampaignDelivery.mockResolvedValue(true);
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
    expect(recordCampaignDelivery).not.toHaveBeenCalled();
  });

  describe("broadcast receipts", () => {
    it("tallies a delivered receipt against the campaign in the ?c= param", async () => {
      // Without this the receipt is dropped: a broadcast creates no thread row, so
      // the SID lookup finds nothing and delivery is invisible.
      await POST(req({ MessageSid: "SM5", MessageStatus: "delivered", To: "+13145550100" }, "?c=2026-07-26T12%3A00%3A00.000Z%23abc"));
      expect(recordCampaignDelivery).toHaveBeenCalledWith("2026-07-26T12:00:00.000Z#abc", "delivered");
    });

    it("tallies undelivered separately from delivered", async () => {
      await POST(req({ MessageSid: "SM6", MessageStatus: "undelivered", To: "+13145550100" }, "?c=k1"));
      expect(recordCampaignDelivery).toHaveBeenCalledWith("k1", "undelivered");
    });

    it("does nothing campaign-side for a 1:1 send (no ?c=)", async () => {
      await POST(req({ MessageSid: "SM7", MessageStatus: "delivered", To: "+13145550100" }));
      expect(recordCampaignDelivery).not.toHaveBeenCalled();
    });

    it("signs against pathname AND query string", async () => {
      // Twilio signs the full callback URL. Validating the pathname alone would
      // reject every broadcast receipt as an invalid signature.
      await POST(req({ MessageSid: "SM8", MessageStatus: "delivered", To: "+13145550100" }, "?c=k2"));
      const [url] = validateTwilioSignature.mock.calls[0] as [string];
      expect(url).toContain("/api/webhooks/twilio/status");
      expect(url).toContain("?c=k2");
    });

    it("still returns 204 when the campaign tally fails (Twilio would retry forever)", async () => {
      recordCampaignDelivery.mockRejectedValue(new Error("gone"));
      const res = await POST(req({ MessageSid: "SM9", MessageStatus: "delivered", To: "+13145550100" }, "?c=k3"));
      expect(res.status).toBe(204);
    });
  });
});
