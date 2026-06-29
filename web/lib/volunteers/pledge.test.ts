import { describe, it, expect, vi, beforeEach } from "vitest";

// reconcilePledgeOnGift marks a "Donor Pledge" volunteer fulfilled when a matching
// WinRed gift lands — conditional (existing Donor-Pledge record only), best-effort,
// and mirrored to Airtable. DB + mirror are mocked.
vi.mock("server-only", () => ({}));

const send = vi.fn();
vi.mock("@/lib/db", () => ({
  ddb: { send: (c: unknown) => send(c) },
  TABLE: "T",
  PK: { volunteers: "VOL" },
  dbConfigured: true,
}));
const mirror = vi.fn();
vi.mock("@/lib/volunteers/airtable", () => ({
  mirrorVolunteerPledgeFulfilledToAirtable: (...a: unknown[]) => mirror(...a),
}));

import { reconcilePledgeOnGift } from "./pledge";

const inputOf = (i = 0) => (send.mock.calls[i][0] as { input: Record<string, unknown> }).input;
const condFail = () => Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });

beforeEach(() => {
  send.mockReset().mockResolvedValue({ Attributes: { airtableId: "recA" } });
  mirror.mockReset().mockResolvedValue(undefined);
});

describe("reconcilePledgeOnGift", () => {
  it("stamps the pledge (door-conditioned) and mirrors fulfillment", async () => {
    await reconcilePledgeOnGift("Dana@X.com", 5000);
    const input = inputOf(0);
    expect((input.Key as { SK: string }).SK).toBe("e:dana@x.com");
    expect(input.ConditionExpression).toContain("#door");
    expect((input.ExpressionAttributeValues as Record<string, unknown>)[":dp"]).toBe("Donor Pledge");
    expect((input.ExpressionAttributeValues as Record<string, unknown>)[":c"]).toBe(5000);
    expect(input.UpdateExpression).toContain("pledgeFulfilledAt");
    expect(mirror).toHaveBeenCalledWith("recA");
  });

  it("is a no-op for a non-pledger (ConditionalCheckFailed)", async () => {
    send.mockRejectedValueOnce(condFail());
    await expect(reconcilePledgeOnGift("x@x.com", 1000)).resolves.toBeUndefined();
    expect(mirror).not.toHaveBeenCalled();
  });

  it("does nothing without an email", async () => {
    await reconcilePledgeOnGift(null, 1000);
    expect(send).not.toHaveBeenCalled();
  });

  it("normalizes a missing/zero amount to 0", async () => {
    await reconcilePledgeOnGift("d@x.com");
    expect((inputOf(0).ExpressionAttributeValues as Record<string, unknown>)[":c"]).toBe(0);
  });
});
