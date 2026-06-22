import { vi, describe, it, expect, beforeEach } from "vitest";

// Capture what saveProfile writes and stub what getProfile reads.
const h = vi.hoisted(() => ({ sends: [] as { input: Record<string, unknown> }[], item: undefined as unknown }));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
      h.sends.push(cmd);
      return "UpdateExpression" in cmd.input ? {} : { Item: h.item };
    }),
  },
  TABLE: "T",
  PK: { profile: "PROFILE" },
  dbConfigured: true,
}));

import { getProfile, saveProfile } from "@/lib/profile";

beforeEach(() => {
  h.sends.length = 0;
  h.item = undefined;
});

describe("saveProfile", () => {
  it("validates/normalizes untrusted input — drops unknown issues, ways, and bad zips", async () => {
    await saveProfile("Jane@X.co", {
      issues: ["term-limits", "not-a-real-issue", 42],
      waysToHelp: ["volunteer", "hack-the-vote"],
      zip: "63101-1234",
    });
    const w = h.sends.find((c) => "UpdateExpression" in c.input)!.input;
    expect(w.Key).toEqual({ PK: "PROFILE", SK: "jane@x.co" });
    expect((w.ExpressionAttributeValues as Record<string, unknown>)[":i"]).toEqual(["term-limits"]);
    expect((w.ExpressionAttributeValues as Record<string, unknown>)[":w"]).toEqual(["volunteer"]);
    expect((w.ExpressionAttributeValues as Record<string, unknown>)[":z"]).toBe("63101");
  });

  it("omits zip from the write when it isn't a valid 5-digit zip", async () => {
    await saveProfile("a@b.co", { issues: [], waysToHelp: [], zip: "nope" });
    const w = h.sends.find((c) => "UpdateExpression" in c.input)!.input;
    expect(w.UpdateExpression).not.toContain("zip");
    expect((w.ExpressionAttributeValues as Record<string, unknown>)[":z"]).toBeUndefined();
  });
});

describe("getProfile", () => {
  it("returns null when there's no row", async () => {
    h.item = undefined;
    expect(await getProfile("nobody@x.co")).toBeNull();
  });

  it("filters stored values back through the validators on read", async () => {
    h.item = { issues: ["term-limits", "garbage"], waysToHelp: ["share", "bogus"], zip: "63101" };
    expect(await getProfile("a@b.co")).toMatchObject({ issues: ["term-limits"], waysToHelp: ["share"], zip: "63101" });
  });
});
