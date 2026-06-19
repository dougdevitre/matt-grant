import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the data layer so we can assert what recordContribution sends to DynamoDB
// without a real table. GetCommand (dedupe read) returns h.getResult; any command
// carrying an UpdateExpression is the write and returns {}.
const h = vi.hoisted(() => ({ sends: [] as { input: Record<string, unknown> }[], getResult: { Item: undefined as unknown } }));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
      h.sends.push(cmd);
      return "UpdateExpression" in cmd.input ? {} : h.getResult;
    }),
  },
  TABLE: "T",
  PK: { donors: "DONOR" },
  newId: () => "generated-id",
  dbConfigured: true,
}));

import { recordContribution } from "@/lib/donors";

const writes = () => h.sends.filter((c) => "UpdateExpression" in c.input);
const reads = () => h.sends.filter((c) => !("UpdateExpression" in c.input));

beforeEach(() => {
  h.sends.length = 0;
  h.getResult = { Item: undefined };
});

describe("recordContribution", () => {
  it("is idempotent: a known externalId is read but not re-written", async () => {
    h.getResult = { Item: { contributions: [{ externalId: "wr_123", amountCents: 5000 }] } };
    await recordContribution({ email: "Jane@Example.com", externalId: "wr_123", amountCents: 5000 });
    expect(reads()).toHaveLength(1); // the dedupe Get happened
    expect(writes()).toHaveLength(0); // ...and no double-count write
  });

  it("appends a new gift and accumulates on one row keyed by email", async () => {
    await recordContribution({ email: "Jane@Example.com", amountCents: 500.4, name: "Jane", employer: "Acme", externalId: "wr_999" });
    const w = writes();
    expect(w).toHaveLength(1);
    const input = w[0].input as { Key: { SK: string }; UpdateExpression: string; ExpressionAttributeValues: Record<string, unknown> };
    expect(input.Key.SK).toBe("e:jane@example.com"); // stable per-email key, lowercased
    expect(input.UpdateExpression).toContain("list_append");
    const gift = (input.ExpressionAttributeValues[":new"] as { amountCents: number; externalId?: string }[])[0];
    expect(gift.amountCents).toBe(500); // rounded to cents
    expect(gift.externalId).toBe("wr_999");
    expect(input.ExpressionAttributeValues[":emp"]).toBe("Acme");
  });

  it("records a profile update with no gift when amount is zero/absent", async () => {
    await recordContribution({ email: "a@b.co", employer: "NewCo" });
    const input = writes()[0].input as { ExpressionAttributeValues: Record<string, unknown> };
    expect(input.ExpressionAttributeValues[":new"]).toEqual([]); // no contribution appended
    expect(input.ExpressionAttributeValues[":emp"]).toBe("NewCo"); // but profile still updated
  });

  it("only dedupes when BOTH externalId and email are present (manual gifts use a fresh key)", async () => {
    await recordContribution({ amountCents: 1000, method: "Cash" });
    expect(reads()).toHaveLength(0); // no dedupe read without email+externalId
    const input = writes()[0].input as { Key: { SK: string } };
    expect(input.Key.SK).toBe("generated-id");
  });
});
