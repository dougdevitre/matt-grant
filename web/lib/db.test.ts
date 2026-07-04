import { describe, it, expect, vi, afterEach } from "vitest";
import * as db from "./db";
import { PK, newId } from "./db";

// These guard against partition-key drift: every entity type lives in its own
// partition, so two collections sharing a PK string would silently cross-
// contaminate each other's Query results. The function-style PKs must likewise
// namespace by a distinct prefix.

describe("PK partition keys", () => {
  const staticVals = Object.entries(PK).filter(([, v]) => typeof v === "string") as [string, string][];
  const fnEntries = Object.entries(PK).filter(([, v]) => typeof v === "function") as [string, (s: string) => string][];

  it("has no duplicate static partition strings", () => {
    const vals = staticVals.map(([, v]) => v);
    expect(new Set(vals).size).toBe(vals.length);
  });

  it("namespaces function-style PKs with a '#'-delimited prefix", () => {
    for (const [, fn] of fnEntries) {
      const out = fn("slug-1");
      expect(out).toContain("#");
      expect(out.endsWith("slug-1")).toBe(true);
    }
  });

  it("keeps function-PK prefixes distinct from every static partition string", () => {
    const staticSet = new Set(staticVals.map(([, v]) => v));
    for (const [, fn] of fnEntries) {
      const prefix = fn("x").split("#")[0];
      // A function PK's prefix (e.g. "VOTES") must not collide with a whole
      // static partition (e.g. "VOTE") in a way that produces an identical key.
      expect(staticSet.has(fn("x"))).toBe(false);
      expect(prefix.length).toBeGreaterThan(0);
    }
  });

  it("newId returns a v4-style UUID", () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(newId()).not.toBe(newId()); // fresh each call
  });
});

// queryAllPages must follow LastEvaluatedKey to the end. A single Query page caps
// at 1 MB, so treating page 1 as "all rows" silently truncates large partitions —
// the exact bug behind stranded campaigns, undercounted segments, and dropped
// opt-in recipients. ddb is the exported singleton queryAllPages calls, so spying
// its `send` drives the pagination loop directly.
describe("queryAllPages", () => {
  afterEach(() => vi.restoreAllMocks());

  const input = { TableName: "t", KeyConditionExpression: "PK = :p", ExpressionAttributeValues: { ":p": "X" } };
  const spySend = () => vi.spyOn(db.ddb, "send" as never) as unknown as ReturnType<typeof vi.fn>;
  const inputOf = (call: unknown) => (call as [{ input: Record<string, unknown> }])[0].input;

  it("concatenates every page and threads each LastEvaluatedKey into the next ExclusiveStartKey", async () => {
    const send = spySend();
    send
      .mockResolvedValueOnce({ Items: [{ id: 1 }, { id: 2 }], LastEvaluatedKey: { PK: "X", SK: "2" } })
      .mockResolvedValueOnce({ Items: [{ id: 3 }] }); // no LastEvaluatedKey → stop

    const items = await db.queryAllPages(input);

    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(inputOf(send.mock.calls[0]).ExclusiveStartKey).toBeUndefined();
    expect(inputOf(send.mock.calls[1]).ExclusiveStartKey).toEqual({ PK: "X", SK: "2" });
  });

  it("returns a single page's items when there is no LastEvaluatedKey", async () => {
    const send = spySend();
    send.mockResolvedValueOnce({ Items: [{ id: 1 }] });
    expect(await db.queryAllPages(input)).toEqual([{ id: 1 }]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("tolerates an empty page (no Items field)", async () => {
    const send = spySend();
    send.mockResolvedValueOnce({});
    expect(await db.queryAllPages(input)).toEqual([]);
  });
});
