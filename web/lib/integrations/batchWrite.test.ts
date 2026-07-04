import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock the data layer so we can drive DynamoDB responses. h.responses is a queue
// consumed FIFO per ddb.send call; an empty queue means "no UnprocessedItems".
const h = vi.hoisted(() => ({
  responses: [] as Record<string, unknown>[],
  calls: [] as { input: { RequestItems: Record<string, unknown[]> } }[],
}));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: { RequestItems: Record<string, unknown[]> } }) => {
      h.calls.push(cmd);
      return h.responses.shift() ?? {};
    }),
  },
  TABLE: "T",
}));

import { batchWritePut } from "@/lib/integrations/batchWrite";

const items = (n: number) => Array.from({ length: n }, (_, i) => ({ PK: "p", SK: `s${i}` }));
const putReq = (sk: string) => ({ PutRequest: { Item: { PK: "p", SK: sk } } });
const count = (i: number) => h.calls[i].input.RequestItems.T.length;

beforeEach(() => {
  h.responses.length = 0;
  h.calls.length = 0;
  // Collapse the backoff sleep so the retry/throw paths run instantly.
  vi.stubGlobal("setTimeout", (fn: () => void) => {
    fn();
    return 0 as unknown as NodeJS.Timeout;
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("batchWritePut", () => {
  it("chunks writes into batches of 25", async () => {
    await batchWritePut(items(30));
    expect(h.calls).toHaveLength(2);
    expect(count(0)).toBe(25);
    expect(count(1)).toBe(5);
  });

  it("retries only the UnprocessedItems, then succeeds", async () => {
    h.responses.push({ UnprocessedItems: { T: [putReq("s0"), putReq("s1")] } }, {});
    await batchWritePut(items(3));
    expect(h.calls).toHaveLength(2); // initial send + one retry
    expect(count(1)).toBe(2); // only the two unprocessed items re-sent
  });

  it("throws loudly rather than silently dropping when items never clear", async () => {
    for (let i = 0; i < 10; i++) h.responses.push({ UnprocessedItems: { T: [putReq("s0")] } });
    await expect(batchWritePut(items(1))).rejects.toThrow(/unprocessed/);
  });
});
