import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const resolveCredentials = vi.fn();
const getConversation = vi.fn();
const isSenderBlocked = vi.fn();
const logOutbound = vi.fn();

vi.mock("@/lib/social/publish", () => ({ resolveCredentials: (...a: unknown[]) => resolveCredentials(...a) }));
vi.mock("@/lib/social/credentials", () => ({ META_GRAPH: "https://graph.test/v21.0" }));
// Keep the real canReplyNow + convoKey; only stub the DB-touching functions.
vi.mock("@/lib/messenger/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./conversations")>()),
  getConversation: (...a: unknown[]) => getConversation(...a),
  isSenderBlocked: (...a: unknown[]) => isSenderBlocked(...a),
  logOutbound: (...a: unknown[]) => logOutbound(...a),
}));

import { sendMessengerReply } from "./send";

const fresh = (over = {}) => ({ lastInboundAt: new Date().toISOString(), ...over });
const okCreds = (channel: string) =>
  channel === "instagram" ? { token: "PAGE_TOKEN", accountId: "IG_123" } : { token: "PAGE_TOKEN", accountId: "PAGE_1" };

beforeEach(() => {
  vi.clearAllMocks();
  resolveCredentials.mockImplementation((c: string) => Promise.resolve(okCreds(c)));
  isSenderBlocked.mockResolvedValue(false);
  getConversation.mockResolvedValue(fresh());
  logOutbound.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid_1" }) }));
});
afterEach(() => vi.unstubAllGlobals());

describe("sendMessengerReply", () => {
  it("refuses when Messenger isn't connected", async () => {
    resolveCredentials.mockResolvedValue(null);
    const r = await sendMessengerReply({ platform: "messenger", psid: "u1", text: "hi" });
    expect(r.sent).toBe(false);
    expect(r.reason).toMatch(/isn't connected/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a blank message and a blocked sender", async () => {
    expect((await sendMessengerReply({ platform: "messenger", psid: "u1", text: "  " })).sent).toBe(false);
    isSenderBlocked.mockResolvedValue(true);
    const r = await sendMessengerReply({ platform: "messenger", psid: "u1", text: "hi" });
    expect(r.sent).toBe(false);
    expect(r.reason).toMatch(/blocked/i);
  });

  it("refuses outside the 24h window and never calls Meta", async () => {
    getConversation.mockResolvedValue(fresh({ lastInboundAt: new Date(Date.now() - 25 * 3600_000).toISOString() }));
    const r = await sendMessengerReply({ platform: "messenger", psid: "u1", text: "hi" });
    expect(r.sent).toBe(false);
    expect(r.reason).toMatch(/24-hour/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a Messenger reply via /me/messages and logs it", async () => {
    const r = await sendMessengerReply({ platform: "messenger", psid: "u1", text: "Thanks for reaching out!", by: "a@x.com" });
    expect(r).toEqual({ sent: true, mid: "mid_1" });
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("/me/messages");
    expect(url).toContain("access_token=PAGE_TOKEN");
    expect(logOutbound).toHaveBeenCalledWith(expect.objectContaining({ platform: "messenger", psid: "u1", status: "sent", mid: "mid_1", by: "a@x.com" }));
  });

  it("routes an Instagram reply through the linked IG account id", async () => {
    const r = await sendMessengerReply({ platform: "instagram", psid: "ig1", text: "hi" });
    expect(r.sent).toBe(true);
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string).toContain("/IG_123/messages");
  });

  it("logs a failed send with the Meta error and returns it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: "outside window" } }) }));
    const r = await sendMessengerReply({ platform: "messenger", psid: "u1", text: "hi" });
    expect(r.sent).toBe(false);
    expect(r.reason).toBe("outside window");
    expect(logOutbound).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
