import { describe, it, expect } from "vitest";
import { toE164, expectedTwilioSignature } from "@/lib/sms/send";

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
