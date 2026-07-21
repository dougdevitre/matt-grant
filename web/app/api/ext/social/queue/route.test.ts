import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkCap = vi.fn();
const listPosts = vi.fn();

vi.mock("@/lib/auth", () => ({ checkCap: (c: string) => checkCap(c) }));
vi.mock("@/lib/social/schedule", () => ({ listPosts: (...a: unknown[]) => listPosts(...a) }));

import { GET } from "./route";
import { CAMPAIGN } from "@/lib/site";

const EXT = "chrome-extension://abcdefghijklmnop";
const prev = process.env.EXTENSION_ORIGIN;
const req = () => new Request("http://test/api/ext/social/queue", { headers: { origin: EXT } });

const readyPost = {
  id: "post_1",
  createdAt: "2026-07-20T10:00:00.000Z",
  scheduledAt: "2026-07-21T14:00:00.000Z",
  caption: "Early voting is open.",
  hashtags: ["MO02"],
  link: "https://mattgrantforcongress.org/vote",
  cta: "Vote August 4",
  mediaUrl: "https://cdn.example/x.png",
  channels: ["x", "facebook"],
  status: "awaiting",
  perChannel: { x: { status: "ready", mode: "manual" }, facebook: { status: "posted", mode: "api" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EXTENSION_ORIGIN = EXT;
  checkCap.mockResolvedValue({ allowed: true, gate: { email: "a@x.com" } });
});
afterEach(() => {
  process.env.EXTENSION_ORIGIN = prev;
});

describe("GET /api/ext/social/queue", () => {
  it("403 without manageSocial", async () => {
    checkCap.mockResolvedValue({ allowed: false, gate: { email: null } });
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(listPosts).not.toHaveBeenCalled();
  });

  it("returns only awaiting/partial posts, only their ready (manual) channels, with paste-ready text", async () => {
    listPosts.mockResolvedValue([
      readyPost,
      { ...readyPost, id: "post_2", status: "posted" }, // filtered out
    ]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; channels: Array<{ channel: string; text: string }> }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("post_1");
    // Only the "ready" manual channel (x) surfaces — facebook already posted.
    expect(body.data[0].channels.map((c) => c.channel)).toEqual(["x"]);
    // The text is the precise renderer output — disclaimer included.
    expect(body.data[0].channels[0].text).toContain(CAMPAIGN.paidForBy);
  });
});
