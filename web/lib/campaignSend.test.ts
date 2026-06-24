import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the send wrapper + URL builders so we can assert exactly what
// sendBroadcastEmail hands the SES layer: the per-recipient tokens and the
// RFC 8058 List-Unsubscribe headers.
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/subscribers", () => ({
  unsubscribeUrl: async (base: string, to: string) => `${base}/u?e=${encodeURIComponent(to)}`,
  unsubscribeApiUrl: async (base: string, to: string) => `${base}/api/unsubscribe?e=${encodeURIComponent(to)}`,
}));
vi.mock("@/lib/site", () => ({ CAMPAIGN: { email: "campaign@x.org" } }));

import { sendBroadcastEmail } from "./campaignSend";

const email = { subject: "Hi", html: "<p>Hi {{first_name}} {{unsubscribe_url}}</p>", text: "Hi" };

beforeEach(() => {
  vi.clearAllMocks();
  sendEmail.mockResolvedValue({ sent: true, id: "m1" });
});

describe("sendBroadcastEmail", () => {
  it("passes per-recipient unsubscribe/preferences/first_name tokens", async () => {
    await sendBroadcastEmail({ to: "voter@x.org", email, base: "https://site.test", firstName: "  Pat  " });
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.tokens.unsubscribe_url).toBe("https://site.test/u?e=voter%40x.org");
    expect(arg.tokens.preferences_url).toBe("https://site.test/u?e=voter%40x.org");
    expect(arg.tokens.first_name).toBe("Pat"); // trimmed
  });

  it("falls back to a neutral greeting when no first name is given", async () => {
    await sendBroadcastEmail({ to: "voter@x.org", email, base: "https://site.test" });
    expect(sendEmail.mock.calls[0][0].tokens.first_name).toBe("there");
  });

  it("sets the one-click List-Unsubscribe headers", async () => {
    await sendBroadcastEmail({ to: "voter@x.org", email, base: "https://site.test" });
    const headers: { name: string; value: string }[] = sendEmail.mock.calls[0][0].headers;
    const unsub = headers.find((h) => h.name === "List-Unsubscribe");
    const post = headers.find((h) => h.name === "List-Unsubscribe-Post");
    expect(unsub?.value).toContain("<https://site.test/api/unsubscribe?e=voter%40x.org>");
    expect(unsub?.value).toContain("mailto:campaign@x.org?subject=unsubscribe");
    expect(post?.value).toBe("List-Unsubscribe=One-Click");
  });

  it("tags the send with the campaign id when provided", async () => {
    await sendBroadcastEmail({ to: "voter@x.org", email, base: "https://site.test", campaignId: "c-7" });
    expect(sendEmail.mock.calls[0][0].tags).toEqual([{ name: "campaign_id", value: "c-7" }]);
  });
});
