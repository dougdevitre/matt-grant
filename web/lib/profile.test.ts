import { vi, describe, it, expect, beforeEach } from "vitest";

// Capture writes; stub reads. Get → { Item }, Query (KeyConditionExpression) →
// { Items }, Update → {}.
const h = vi.hoisted(() => ({
  sends: [] as { input: Record<string, unknown> }[],
  item: undefined as unknown,
  items: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
      h.sends.push(cmd);
      if ("UpdateExpression" in cmd.input) return {};
      if ("KeyConditionExpression" in cmd.input) return { Items: h.items };
      return { Item: h.item };
    }),
  },
  TABLE: "T",
  PK: { profile: "PROFILE" },
  dbConfigured: true,
  // segmentEmails()/segmentCounts() paginate via queryAllPages; return the same
  // stubbed rows the ddb.send Query path would.
  queryAllPages: async () => h.items,
}));

import { getProfile, saveProfile, setVoterRegistration, segmentEmails, segmentCounts } from "@/lib/profile";

beforeEach(() => {
  h.sends.length = 0;
  h.item = undefined;
  h.items = [];
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

  it("reads the self-attested registeredToVote flag (boolean only)", async () => {
    h.item = { issues: [], waysToHelp: [], registeredToVote: true };
    expect((await getProfile("a@b.co"))?.registeredToVote).toBe(true);
    h.item = { issues: [], waysToHelp: [], registeredToVote: "yes" }; // not a boolean → undefined
    expect((await getProfile("a@b.co"))?.registeredToVote).toBeUndefined();
  });
});

describe("setVoterRegistration", () => {
  it("writes the boolean flag, self-scoped to the lowercased email", async () => {
    await setVoterRegistration("Jane@X.co", true);
    const w = h.sends.find((c) => "UpdateExpression" in c.input)!.input;
    expect(w.Key).toEqual({ PK: "PROFILE", SK: "jane@x.co" });
    expect((w.ExpressionAttributeValues as Record<string, unknown>)[":v"]).toBe(true);
    expect(w.UpdateExpression).toContain("registeredToVote = :v");
  });

  it("can clear the flag (false)", async () => {
    await setVoterRegistration("a@b.co", false);
    const w = h.sends.find((c) => "UpdateExpression" in c.input)!.input;
    expect((w.ExpressionAttributeValues as Record<string, unknown>)[":v"]).toBe(false);
  });
});

describe("segmentEmails (targeting)", () => {
  it("returns lowercased emails of supporters who care about the issue", async () => {
    h.items = [
      { SK: "Yes@X.co", issues: ["family-courts", "term-limits"] },
      { SK: "no@x.co", issues: ["lower-taxes"] },
      { SK: "also@x.co", issues: ["family-courts"] },
    ];
    expect(await segmentEmails({ issue: "family-courts" })).toEqual(["yes@x.co", "also@x.co"]);
  });

  it("can intersect issue + way-to-help", async () => {
    h.items = [
      { SK: "a@x.co", issues: ["term-limits"], waysToHelp: ["volunteer"] },
      { SK: "b@x.co", issues: ["term-limits"], waysToHelp: ["donate"] },
    ];
    expect(await segmentEmails({ issue: "term-limits", wayToHelp: "volunteer" })).toEqual(["a@x.co"]);
  });
});

describe("segmentCounts", () => {
  it("tallies supporters per issue AND per way-to-help (ignoring unknown values)", async () => {
    h.items = [
      { issues: ["family-courts", "term-limits"], waysToHelp: ["volunteer", "share"] },
      { issues: ["family-courts", "bogus"], waysToHelp: ["volunteer"] },
      { issues: ["lower-taxes"], waysToHelp: ["host", "nope"] },
    ];
    expect(await segmentCounts()).toEqual({
      issues: { "family-courts": 2, "term-limits": 1, "lower-taxes": 1 },
      ways: { volunteer: 2, share: 1, host: 1 },
    });
  });
});
