import { describe, it, expect, vi, beforeEach } from "vitest";

const getSecret = vi.fn();
const socialAppParam = vi.fn();
const verifyMetaSignature = vi.fn();
const verifyChallengeToken = vi.fn();
const logInbound = vi.fn();
const isSenderBlocked = vi.fn();
const notifyStaffInboundMessenger = vi.fn();

vi.mock("@/lib/ssm", () => ({ getSecret: (...a: unknown[]) => getSecret(...a) }));
vi.mock("@/lib/social/credentials", () => ({ socialAppParam: (...a: unknown[]) => socialAppParam(...a) }));
vi.mock("@/lib/messenger/signature", () => ({
  verifyMetaSignature: (...a: unknown[]) => verifyMetaSignature(...a),
  verifyChallengeToken: (...a: unknown[]) => verifyChallengeToken(...a),
}));
vi.mock("@/lib/messenger/conversations", () => ({
  logInbound: (...a: unknown[]) => logInbound(...a),
  isSenderBlocked: (...a: unknown[]) => isSenderBlocked(...a),
  convoKey: (p: string, psid: string) => `${p}:${psid}`,
}));
vi.mock("@/lib/notifications/staffNotify", () => ({ notifyStaffInboundMessenger: (...a: unknown[]) => notifyStaffInboundMessenger(...a) }));

import { GET, POST } from "./route";

const post = (body: unknown, sig = "sha256=x") =>
  ({
    text: async () => JSON.stringify(body),
    headers: { get: (k: string) => (k === "x-hub-signature-256" ? sig : null) },
  }) as unknown as Parameters<typeof POST>[0];

const get = (params: Record<string, string>) =>
  ({ nextUrl: { searchParams: new URLSearchParams(params) } }) as unknown as Parameters<typeof GET>[0];

const messengerEvent = (text: string, is_echo = false) => ({
  object: "page",
  entry: [{ messaging: [{ sender: { id: "u1" }, message: { mid: "m1", text, is_echo } }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
  getSecret.mockResolvedValue("verify-token");
  socialAppParam.mockResolvedValue("app-secret");
  verifyMetaSignature.mockReturnValue(true);
  verifyChallengeToken.mockReturnValue(true);
  logInbound.mockResolvedValue(1);
  isSenderBlocked.mockResolvedValue(false);
});

describe("GET /api/webhooks/meta (handshake)", () => {
  it("echoes the challenge when the verify token matches", async () => {
    const res = await GET(get({ "hub.mode": "subscribe", "hub.verify_token": "verify-token", "hub.challenge": "42" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("42");
  });
  it("403s on a wrong verify token", async () => {
    verifyChallengeToken.mockReturnValue(false);
    const res = await GET(get({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/webhooks/meta (events)", () => {
  it("403s on a bad signature and never logs", async () => {
    verifyMetaSignature.mockReturnValue(false);
    const res = await POST(post(messengerEvent("hi")));
    expect(res.status).toBe(403);
    expect(logInbound).not.toHaveBeenCalled();
  });

  it("logs a Messenger message and alerts staff on the first unread", async () => {
    const res = await POST(post(messengerEvent("Hello Matt")));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EVENT_RECEIVED");
    expect(logInbound).toHaveBeenCalledWith(expect.objectContaining({ platform: "messenger", psid: "u1", body: "Hello Matt", mid: "m1" }));
    expect(notifyStaffInboundMessenger).toHaveBeenCalledWith(expect.objectContaining({ key: "messenger:u1", channel: "Messenger" }));
  });

  it("skips our own echoes and non-text events", async () => {
    await POST(post(messengerEvent("mirror", true)));
    await POST(post({ object: "page", entry: [{ messaging: [{ sender: { id: "u2" }, message: { mid: "m2" } }] }] }));
    expect(logInbound).not.toHaveBeenCalled();
  });

  it("routes Instagram DMs (object=instagram) and doesn't alert past the first unread", async () => {
    logInbound.mockResolvedValue(3); // 3rd unread — already alerted
    const res = await POST(post({ object: "instagram", entry: [{ messaging: [{ sender: { id: "ig9" }, message: { mid: "m9", text: "DM" } }] }] }));
    expect(res.status).toBe(200);
    expect(logInbound).toHaveBeenCalledWith(expect.objectContaining({ platform: "instagram", psid: "ig9" }));
    expect(notifyStaffInboundMessenger).not.toHaveBeenCalled();
  });

  it("acks 200 even when logging throws (no Meta retry-storm)", async () => {
    logInbound.mockRejectedValue(new Error("db down"));
    const res = await POST(post(messengerEvent("hi")));
    expect(res.status).toBe(200);
  });
});
