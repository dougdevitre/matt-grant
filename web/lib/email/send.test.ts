import { describe, it, expect, vi, beforeEach } from "vitest";

// send.ts reads SES_FROM at module load and constructs a real SES client, so we
// stub the env and mock the AWS SDK *before* a fresh dynamic import each test.
const sesSend = vi.fn();

async function loadSend(withFrom = true) {
  vi.resetModules();
  if (withFrom) vi.stubEnv("SES_FROM", "Matt Grant <info@x.org>");
  else vi.stubEnv("SES_FROM", "");
  // Classes, not arrow fns — send.ts uses `new SESv2Client()` / `new SendEmailCommand()`,
  // and an arrow function can't be a constructor.
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
  vi.doMock("@/lib/site", () => ({ CAMPAIGN: { email: "campaign@x.org" } }));
  return (await import("./send")).sendEmail;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  sesSend.mockResolvedValue({ MessageId: "m-1" });
});

describe("sendEmail merge-token safety net", () => {
  it("refuses to send when a merge token is left unfilled", async () => {
    const sendEmail = await loadSend();
    const res = await sendEmail({ to: "v@x.org", subject: "Hi", html: "<p>{{unsubscribe_url}}</p>", tokens: {} });
    expect(res.sent).toBe(false);
    expect(res.error).toMatch(/unfilled merge token \{\{unsubscribe_url\}\}/);
    expect(sesSend).not.toHaveBeenCalled();
  });

  it("fills provided tokens and sends with no leftover placeholders", async () => {
    const sendEmail = await loadSend();
    const res = await sendEmail({
      to: "v@x.org",
      subject: "Hi",
      html: "<p>Bye <a href='{{unsubscribe_url}}'>unsub</a></p>",
      tokens: { unsubscribe_url: "https://site.test/u?e=v" },
    });
    expect(res.sent).toBe(true);
    const sentHtml = sesSend.mock.calls[0][0].input.Content.Simple.Body.Html.Data;
    expect(sentHtml).toContain("https://site.test/u?e=v");
    expect(sentHtml).not.toContain("{{");
  });

  it("also catches an unfilled token that only appears in the text part", async () => {
    const sendEmail = await loadSend();
    const res = await sendEmail({ to: "v@x.org", subject: "Hi", html: "<p>ok</p>", text: "Unsub: {{unsubscribe_url}}", tokens: {} });
    expect(res.sent).toBe(false);
    expect(res.error).toMatch(/unfilled merge token/);
  });

  it("transactional mail with no tokens passes straight through", async () => {
    const sendEmail = await loadSend();
    const res = await sendEmail({ to: "v@x.org", subject: "Receipt", html: "<p>Thanks!</p>" });
    expect(res.sent).toBe(true);
    expect(sesSend).toHaveBeenCalledOnce();
  });

  it("no-ops when SES isn't configured", async () => {
    const sendEmail = await loadSend(false);
    const res = await sendEmail({ to: "v@x.org", subject: "Hi", html: "<p>hi</p>" });
    expect(res.sent).toBe(false);
    expect(res.error).toBe("SES not configured");
    expect(sesSend).not.toHaveBeenCalled();
  });
});
