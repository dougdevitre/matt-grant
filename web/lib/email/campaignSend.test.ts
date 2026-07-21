import { describe, it, expect, vi, beforeEach } from "vitest";

// E-1 (compliance-audit.md): a BROADCAST-level guarantee that a real send substitutes
// {{unsubscribe_url}} per recipient and never ships a literal placeholder. Runs the
// actual early-vote broadcast through the whole path: registry build → sendBroadcastEmail
// (adds per-recipient tokens + List-Unsubscribe) → sendEmail (fills + refuses leftovers)
// → SES. send.ts reads SES_FROM + constructs the SES client at import, so we mock the SDK
// and stub env before a fresh dynamic import.
const sesSend = vi.fn();

async function load() {
  vi.resetModules();
  vi.stubEnv("SES_FROM", "Matt Grant for Congress <info@x.org>");
  vi.doMock("@aws-sdk/client-sesv2", () => ({
    SESv2Client: class {
      send = sesSend;
      constructor(_cfg?: unknown) {}
    },
    SendEmailCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  }));
  // Real, deterministic per-recipient unsubscribe URLs (the real signer needs a secret).
  vi.doMock("@/lib/subscribers", () => ({
    unsubscribeUrl: async (base: string, to: string) => `${base}/unsubscribe?token=tok-${encodeURIComponent(to)}`,
    unsubscribeApiUrl: async (base: string, to: string) => `${base}/api/unsubscribe?token=tok-${encodeURIComponent(to)}`,
  }));
  const { sendBroadcastEmail } = await import("@/lib/campaignSend");
  const { getBroadcast } = await import("@/lib/email/broadcasts");
  return { sendBroadcastEmail, getBroadcast };
}

const sentPayload = () => sesSend.mock.calls[0][0].input as {
  Content: { Simple: { Body: { Html: { Data: string }; Text: { Data: string } } } };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  sesSend.mockResolvedValue({ MessageId: "m-1" });
});

describe("broadcast send — unsubscribe substitution (E-1)", () => {
  it("the early-vote broadcast ships a real unsubscribe URL and NO leftover {{token}}", async () => {
    const { sendBroadcastEmail, getBroadcast } = await load();
    const email = getBroadcast("early-vote")!.build({});
    // The rendered template still carries the per-recipient placeholder before send.
    expect(email.html).toContain("{{unsubscribe_url}}");

    const res = await sendBroadcastEmail({ to: "voter@x.org", email, base: "https://site.test", campaignId: "c1", firstName: "Jordan" });
    expect(res.sent).toBe(true);

    const { Html, Text } = sentPayload().Content.Simple.Body;
    expect(Html.Data).toContain("https://site.test/unsubscribe?token=tok-voter%40x.org");
    expect(Html.Data).not.toContain("{{"); // nothing left unsubstituted
    expect(Text.Data).toContain("https://site.test/unsubscribe?token=tok-voter%40x.org");
    expect(Text.Data).not.toContain("{{");
  });

  it("refuses end-to-end if the built email still has an unfilled staff token", async () => {
    // The gotv broadcast requires polling_place_url; sending it without that value must
    // be refused by the send layer rather than shipping a literal {{polling_place_url}}.
    const { sendBroadcastEmail, getBroadcast } = await load();
    const email = getBroadcast("gotv")!.build({}); // no polling_place_url
    const res = await sendBroadcastEmail({ to: "voter@x.org", email, base: "https://site.test" });
    expect(res.sent).toBe(false);
    expect(res.error).toMatch(/unfilled merge token \{\{polling_place_url\}\}/);
    expect(sesSend).not.toHaveBeenCalled();
  });
});
