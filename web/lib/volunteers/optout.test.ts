import { describe, it, expect, vi, beforeEach } from "vitest";

// setVolunteerContactOptOut flags the matching volunteer (by email or phone) and
// mirrors it to Airtable — best-effort, only touching an existing record, and
// bridging E.164 phone numbers to web-typed ones. DB + mirror are mocked.
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
  mirrorVolunteerOptOutToAirtable: (...a: unknown[]) => mirror(...a),
}));

import { setVolunteerContactOptOut } from "./optout";

const inputOf = (i = 0) => (send.mock.calls[i][0] as { input: Record<string, unknown> }).input;
const condFail = () => Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });

beforeEach(() => {
  send.mockReset().mockResolvedValue({ Attributes: { airtableId: "recA" } });
  mirror.mockReset().mockResolvedValue(undefined);
});

describe("setVolunteerContactOptOut", () => {
  it("flags by email (lowercased key) and mirrors the airtable id", async () => {
    await setVolunteerContactOptOut({ email: "Dana@X.com" }, true);
    const input = inputOf(0);
    expect((input.Key as { SK: string }).SK).toBe("e:dana@x.com");
    expect(input.ConditionExpression).toContain("attribute_exists");
    expect((input.ExpressionAttributeValues as Record<string, unknown>)[":o"]).toBe(true);
    expect(mirror).toHaveBeenCalledWith("recA", true);
  });

  it("clears the flag (optedOut=false) on re-subscribe", async () => {
    await setVolunteerContactOptOut({ email: "d@x.com" }, false);
    expect((inputOf(0).ExpressionAttributeValues as Record<string, unknown>)[":o"]).toBe(false);
    expect(mirror).toHaveBeenCalledWith("recA", false);
  });

  it("bridges an E.164 phone to a 10-digit web key when the first try misses", async () => {
    send.mockRejectedValueOnce(condFail()); // p:13145550123 not found
    send.mockResolvedValueOnce({ Attributes: { airtableId: "recB" } }); // p:3145550123 hit
    await setVolunteerContactOptOut({ phone: "+13145550123" }, true);
    expect((inputOf(0).Key as { SK: string }).SK).toBe("p:13145550123");
    expect((inputOf(1).Key as { SK: string }).SK).toBe("p:3145550123");
    expect(mirror).toHaveBeenCalledWith("recB", true);
  });

  it("no matching volunteer → no mirror, no throw", async () => {
    send.mockRejectedValue(condFail());
    await expect(setVolunteerContactOptOut({ phone: "+13145550123" }, true)).resolves.toBeUndefined();
    expect(mirror).not.toHaveBeenCalled();
  });

  it("does nothing without an email or phone", async () => {
    await setVolunteerContactOptOut({}, true);
    expect(send).not.toHaveBeenCalled();
  });
});
