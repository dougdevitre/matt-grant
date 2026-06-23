import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Unit-test the scheduler in isolation: mock the DynamoDB layer (same pattern as
// donors.test.ts) so we can drive drainDue()/cancelPost() without a real table,
// and mock the publish layer so the claim/rollup/resilience logic is tested apart
// from the real platform adapters. Commands are told apart by their params:
//   • KeyConditionExpression  → allPosts() query
//   • :posting in values      → the scheduled→posting CLAIM update
//   • :c       in values      → cancelPost update
//   • :pc      in values      → the per-channel result write
const h = vi.hoisted(() => ({
  sends: [] as { input: Record<string, unknown> }[],
  items: [] as Record<string, unknown>[],
  claimFail: new Map<string, "cce" | "other">(), // SK → how its claim should fail
  resultFail: new Set<string>(), // SKs whose result write throws
  cancelFail: null as null | "cce" | "other",
}));

function cce() {
  return Object.assign(new Error("conditional check failed"), { name: "ConditionalCheckFailedException" });
}

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
      h.sends.push(cmd);
      const input = cmd.input;
      if ("KeyConditionExpression" in input) return { Items: h.items };
      if ("UpdateExpression" in input) {
        const sk = (input.Key as { SK?: string })?.SK ?? "";
        const values = (input.ExpressionAttributeValues ?? {}) as Record<string, unknown>;
        if (":posting" in values) {
          const mode = h.claimFail.get(sk);
          if (mode === "cce") throw cce();
          if (mode === "other") throw new Error("claim boom");
          return {};
        }
        if (":c" in values) {
          if (h.cancelFail === "cce") throw cce();
          if (h.cancelFail === "other") throw new Error("cancel boom");
          return {};
        }
        if (":pc" in values) {
          if (h.resultFail.has(sk)) throw new Error("result write boom");
          return {};
        }
        return {};
      }
      return {};
    }),
  },
  TABLE: "T",
  newId: () => "gen-id",
  dbConfigured: true,
}));

vi.mock("@/lib/social/publish", () => ({ publishToChannel: vi.fn() }));

import { drainDue, cancelPost } from "@/lib/social/schedule";
import { publishToChannel } from "@/lib/social/publish";
import type { ChannelId } from "@/lib/social/channels";

const pub = vi.mocked(publishToChannel);

// A due (past, scheduled) post by default; override any field.
function post(over: Partial<Record<string, unknown>> = {}) {
  const id = (over.id as string) ?? "p1";
  return {
    PK: "SOCIALPOST",
    SK: (over.SK as string) ?? `2020-01-01T00:00:00.000Z#${id}`,
    id,
    status: "scheduled",
    scheduledAt: "2020-01-01T00:00:00.000Z",
    caption: "Hi",
    hashtags: [],
    channels: ["x"] as ChannelId[],
    perChannel: {},
    createdAt: "2020-01-01T00:00:00.000Z",
    createdBy: "sys",
    ...over,
  };
}

const resultWrites = () => h.sends.filter((c) => ":pc" in ((c.input.ExpressionAttributeValues ?? {}) as Record<string, unknown>));

beforeEach(() => {
  h.sends.length = 0;
  h.items = [];
  h.claimFail.clear();
  h.resultFail.clear();
  h.cancelFail = null;
  pub.mockReset();
  pub.mockResolvedValue({ ok: true, mode: "api", externalId: "ext_1" });
});

afterEach(() => vi.restoreAllMocks());

describe("drainDue — selection", () => {
  it("processes only posts that are scheduled and past-due", async () => {
    h.items = [
      post({ id: "due", SK: "2020#due" }),
      post({ id: "future", SK: "2999#future", scheduledAt: "2999-01-01T00:00:00.000Z" }),
      post({ id: "draft", SK: "2020#draft", status: "draft", scheduledAt: undefined }),
      post({ id: "posting", SK: "2020#posting", status: "posting" }),
    ];
    const r = await drainDue();
    expect(r.processed).toBe(1);
    expect(r.posts[0].id).toBe("due");
    expect(pub).toHaveBeenCalledTimes(1);
  });

  it("honors the limit", async () => {
    h.items = [post({ id: "a", SK: "2020#a" }), post({ id: "b", SK: "2020#b" }), post({ id: "c", SK: "2020#c" })];
    const r = await drainDue(2);
    expect(r.processed).toBe(2);
    expect(pub).toHaveBeenCalledTimes(2);
  });
});

describe("drainDue — claim idempotency", () => {
  it("skips a post whose claim was already taken (ConditionalCheckFailedException) and never publishes it", async () => {
    h.items = [post({ id: "taken", SK: "2020#taken" }), post({ id: "mine", SK: "2020#mine" })];
    h.claimFail.set("2020#taken", "cce");
    const r = await drainDue();
    expect(r.processed).toBe(1);
    expect(r.posts[0].id).toBe("mine");
    expect(pub).toHaveBeenCalledTimes(1); // only "mine" published — no double-post
  });

  it("rethrows a non-condition claim error (batch-level failure)", async () => {
    h.items = [post({ id: "x", SK: "2020#x" })];
    h.claimFail.set("2020#x", "other");
    await expect(drainDue()).rejects.toThrow("claim boom");
  });
});

describe("drainDue — per-post resilience", () => {
  it("isolates a post whose result write fails so the rest of the batch still publishes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.items = [post({ id: "bad", SK: "2020#bad" }), post({ id: "good", SK: "2020#good" })];
    h.resultFail.add("2020#bad");
    const r = await drainDue();
    expect(r.processed).toBe(1); // only "good" recorded
    expect(r.posts[0].id).toBe("good");
    expect(pub).toHaveBeenCalledTimes(2); // both attempted; "bad" failed only at the write
    expect(console.error).toHaveBeenCalled();
  });
});

describe("drainDue — status rollup", () => {
  it("writes 'posted' with a postedAt when every channel posts via API", async () => {
    h.items = [post({ id: "p", SK: "2020#p", channels: ["x", "facebook"] as ChannelId[] })];
    pub.mockResolvedValue({ ok: true, mode: "api", externalId: "e" });
    const r = await drainDue();
    expect(r.posts[0].status).toBe("posted");
    const w = resultWrites()[0].input as { ExpressionAttributeValues: Record<string, unknown>; UpdateExpression: string };
    expect(w.ExpressionAttributeValues[":s"]).toBe("posted");
    expect(w.UpdateExpression).toContain("postedAt = :u");
  });

  it("writes 'awaiting' with no postedAt when a manual channel still needs a human", async () => {
    h.items = [post({ id: "p", SK: "2020#p", channels: ["x", "tiktok"] as ChannelId[] })];
    pub.mockImplementation(async (ch: ChannelId) => (ch === "x" ? { ok: true, mode: "api", externalId: "e" } : { ok: true, mode: "manual" }));
    const r = await drainDue();
    expect(r.posts[0].status).toBe("awaiting");
    const w = resultWrites()[0].input as { ExpressionAttributeValues: Record<string, unknown>; UpdateExpression: string };
    expect(w.ExpressionAttributeValues[":s"]).toBe("awaiting");
    expect(w.UpdateExpression).not.toContain("postedAt");
  });
});

describe("cancelPost", () => {
  it("returns true when the cancel update succeeds", async () => {
    h.items = [post({ id: "p1", SK: "2020#p1" })];
    expect(await cancelPost("p1")).toBe(true);
  });

  it("returns false when the id isn't found", async () => {
    h.items = [post({ id: "p1", SK: "2020#p1" })];
    expect(await cancelPost("nope")).toBe(false);
  });

  it("returns false (not a false success) when the post already left a cancelable state", async () => {
    h.items = [post({ id: "p1", SK: "2020#p1" })];
    h.cancelFail = "cce";
    expect(await cancelPost("p1")).toBe(false);
  });

  it("returns false and logs on any other error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    h.items = [post({ id: "p1", SK: "2020#p1" })];
    h.cancelFail = "other";
    expect(await cancelPost("p1")).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});
