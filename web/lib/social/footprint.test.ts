import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the DynamoDB layer (donors.test.ts pattern). PutCommand carries an Item;
// the QueryCommand (listSnapshots) carries a KeyConditionExpression and returns
// h.queryItems.
const h = vi.hoisted(() => ({ sends: [] as { input: Record<string, unknown> }[], queryItems: [] as Record<string, unknown>[] }));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
      h.sends.push(cmd);
      if ("KeyConditionExpression" in cmd.input) return { Items: h.queryItems };
      return {};
    }),
  },
  TABLE: "T",
  newId: () => "gen-id",
  dbConfigured: true,
}));

import { recordSnapshot, listSnapshots } from "@/lib/social/footprint";
import { footprintScore } from "@/lib/social/optimize";

const sampleReport = () =>
  footprintScore([{ channel: "x", followers: 1000, posts30d: 30, impressions30d: 50000, engagements30d: 1500, profileVisits30d: 2000, linkClicks30d: 200, conversions30d: 10 }]);

beforeEach(() => {
  h.sends.length = 0;
  h.queryItems = [];
});

describe("recordSnapshot", () => {
  it("writes a FOOTPRINT item carrying the index, totals, per-channel health, and author", async () => {
    const report = sampleReport();
    await recordSnapshot(report, "admin@example.com");
    const put = h.sends.find((c) => "Item" in c.input);
    expect(put).toBeDefined();
    const item = put!.input.Item as Record<string, unknown>;
    expect(item.PK).toBe("FOOTPRINT");
    expect(item.index).toBe(report.index);
    expect(item.totalFollowers).toBe(report.totalFollowers);
    expect(item.takenBy).toBe("admin@example.com");
    expect((item.channelHealth as Record<string, number>).x).toBeTypeOf("number");
  });
});

describe("listSnapshots", () => {
  it("maps rows to typed snapshots", async () => {
    h.queryItems = [{ at: "2026-01-02T00:00:00.000Z", index: 60, totalFollowers: 5000, totalImpressions30d: 1, totalConversions30d: 2, channelHealth: { x: 80 }, takenBy: "a@b.co" }];
    const r = await listSnapshots();
    expect(r).toHaveLength(1);
    expect(r[0].index).toBe(60);
    expect(r[0].channelHealth.x).toBe(80);
    expect(r[0].takenBy).toBe("a@b.co");
  });

  it("coerces missing fields to safe defaults", async () => {
    h.queryItems = [{ at: "2026-01-02T00:00:00.000Z" }];
    const r = await listSnapshots();
    expect(r[0].index).toBe(0);
    expect(r[0].totalFollowers).toBe(0);
    expect(r[0].takenBy).toBe("system");
    expect(r[0].channelHealth).toEqual({});
  });
});
