import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toE164, expectedTwilioSignature, sendSms } from "@/lib/sms/send";

describe("toE164", () => {
  it("normalizes common US formats to +1XXXXXXXXXX", () => {
    expect(toE164("314-555-0100")).toBe("+13145550100");
    expect(toE164("(314) 555-0100")).toBe("+13145550100");
    expect(toE164("3145550100")).toBe("+13145550100");
    expect(toE164("13145550100")).toBe("+13145550100");
    expect(toE164("+1 314 555 0100")).toBe("+13145550100");
  });
  it("rejects junk / wrong-length input", () => {
    expect(toE164("")).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164("555-0100")).toBeNull(); // 7 digits
    expect(toE164("not a phone")).toBeNull();
  });
});

describe("expectedTwilioSignature", () => {
  // Twilio's documented algorithm: URL + sorted(key+value) joined, HMAC-SHA1, base64.
  it("is deterministic and order-independent in the params", () => {
    const url = "https://example.org/api/webhooks/twilio";
    const a = expectedTwilioSignature("tok", url, { From: "+13145550100", Body: "STOP" });
    const b = expectedTwilioSignature("tok", url, { Body: "STOP", From: "+13145550100" });
    expect(a).toBe(b);
    expect(a).not.toBe(expectedTwilioSignature("tok", url, { From: "+13145550100", Body: "START" }));
    expect(a).not.toBe(expectedTwilioSignature("other", url, { From: "+13145550100", Body: "STOP" }));
  });
});

describe("sendSms retry (safe — Twilio creates only on 2xx)", () => {
  beforeEach(() => {
    // creds() reads these env-first via getSecret, so no SSM/network in the test.
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "tok_test";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG_test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  });

  it("retries a 500 then succeeds", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      return n === 1
        ? new Response("err", { status: 500 })
        : new Response(JSON.stringify({ sid: "SM123" }), { status: 201, headers: { "content-type": "application/json" } });
    });
    const r = await sendSms({ to: "314-555-0100", body: "hi" });
    expect(n).toBe(2);
    expect(r.sent).toBe(true);
    expect(r.sid).toBe("SM123");
  });

  it("does not retry a 4xx (e.g. invalid recipient)", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      return new Response(JSON.stringify({ message: "not a mobile number" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    });
    const r = await sendSms({ to: "314-555-0100", body: "hi" });
    expect(n).toBe(1);
    expect(r.sent).toBe(false);
    expect(r.error).toMatch(/not a mobile/);
  });
});
