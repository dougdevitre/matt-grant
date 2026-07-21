import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const confirmChannelPosted = vi.fn();
const recordExtAction = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/social/schedule", () => ({ confirmChannelPosted: (...a: unknown[]) => confirmChannelPosted(...a) }));
vi.mock("@/lib/audit", () => ({ recordExtAction: (...a: unknown[]) => recordExtAction(...a) }));

import { POST } from "./route";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const post = (body: unknown) =>
  new Request("http://test/api/ext/social/posted", {
    method: "POST",
    headers: { origin: EXT, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("POST /api/ext/social/posted", () => {
  it("403 without manageSocial", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await POST(post({ id: "p1", channel: "x" }));
    expect(res.status).toBe(403);
    expect(confirmChannelPosted).not.toHaveBeenCalled();
  });

  it("400 on an unknown channel", async () => {
    const res = await POST(post({ id: "p1", channel: "myspace" }));
    expect(res.status).toBe(400);
    expect(confirmChannelPosted).not.toHaveBeenCalled();
  });

  it("404 when the post/channel isn't found", async () => {
    confirmChannelPosted.mockResolvedValue(false);
    const res = await POST(post({ id: "nope", channel: "x" }));
    expect(res.status).toBe(404);
  });

  it("marks the channel posted and audits", async () => {
    confirmChannelPosted.mockResolvedValue(true);
    const res = await POST(post({ id: "p1", channel: "x" }));
    expect(res.status).toBe(200);
    expect(confirmChannelPosted).toHaveBeenCalledWith("p1", "x");
    expect(recordExtAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "social.markPosted", target: "p1#x", actor: "a@x.com" }),
    );
  });
});
