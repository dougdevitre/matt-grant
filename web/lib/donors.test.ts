import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the data layer so we can assert what recordContribution sends to DynamoDB
// without a real table. Every write carries an UpdateExpression. When
// h.conditionFails is set, the mock throws ConditionalCheckFailedException so we
// can exercise the idempotent no-op path (a duplicate/concurrent webhook delivery).
const h = vi.hoisted(() => ({ sends: [] as { input: Record<string, unknown> }[], conditionFails: false }));

vi.mock("@/lib/db", () => ({
  ddb: {
    send: vi.fn(async (cmd: { input: Record<string, unknown> }) => {
      h.sends.push(cmd);
      if (h.conditionFails && "ConditionExpression" in cmd.input) {
        throw Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
      }
      return {};
    }),
  },
  TABLE: "T",
  PK: { donors: "DONOR" },
  newId: () => "generated-id",
  dbConfigured: true,
}));

import { recordContribution } from "@/lib/donors";

const writes = () => h.sends.filter((c) => "UpdateExpression" in c.input);

beforeEach(() => {
  h.sends.length = 0;
  h.conditionFails = false;
});

describe("recordContribution", () => {
  it("guards the append with a per-externalId condition so retries can't double-count", async () => {
    await recordContribution({ email: "Jane@Example.com", externalId: "wr_123", amountCents: 5000 });
    const input = writes()[0].input as {
      UpdateExpression: string;
      ConditionExpression?: string;
      ExpressionAttributeValues: Record<string, unknown>;
    };
    expect(input.UpdateExpression).toContain("ADD seenIds"); // externalId tracked in a set
    expect(input.ConditionExpression).toContain("contains(seenIds, :xid)"); // only append when new
    expect(input.ExpressionAttributeValues[":xid"]).toBe("wr_123");
  });

  it("is idempotent: a duplicate delivery that fails the condition returns FALSE (no side effects for the caller)", async () => {
    h.conditionFails = true;
    await expect(
      recordContribution({ email: "Jane@Example.com", externalId: "wr_123", amountCents: 5000 }),
    ).resolves.toBe(false); // ConditionalCheckFailedException swallowed → duplicate signal, not a throw
    expect(writes()).toHaveLength(1); // the single atomic write was attempted...
  });

  it("returns TRUE when a new gift is actually recorded (so the webhook may send receipts)", async () => {
    await expect(
      recordContribution({ email: "Jane@Example.com", externalId: "wr_124", amountCents: 5000 }),
    ).resolves.toBe(true);
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

  it("falls back to the externalId as the row key when no email is present", async () => {
    await recordContribution({ amountCents: 1000, externalId: "wr_555" });
    const input = writes()[0].input as { Key: { SK: string }; ConditionExpression?: string };
    expect(input.Key.SK).toBe("x:wr_555"); // retries collapse onto one row instead of a random key
    expect(input.ConditionExpression).toBeDefined(); // still guarded against double-count
  });

  it("uses a fresh key and no condition for a manual gift with neither email nor externalId", async () => {
    await recordContribution({ amountCents: 1000, method: "Cash" });
    const input = writes()[0].input as { Key: { SK: string }; ConditionExpression?: string };
    expect(input.Key.SK).toBe("generated-id");
    expect(input.ConditionExpression).toBeUndefined(); // manual entry isn't retried by a webhook
  });
});
