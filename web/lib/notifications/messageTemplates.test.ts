import { describe, it, expect, vi, beforeEach } from "vitest";

// Drive the template store with a canned DynamoDB client: prove the row→SavedTemplate mapping,
// channel filtering, sort, and that a bad stored role normalizes to null.
const send = vi.fn();
vi.mock("@/lib/db", () => ({
  ddb: { send: (c: unknown) => send(c) },
  TABLE: "t",
  dbConfigured: true,
  PK: { msgTemplates: "MSGTEMPLATE" },
  newId: () => "newid123",
}));

import { listSavedTemplates, createSavedTemplate } from "./messageTemplates";

beforeEach(() => send.mockReset());

describe("message template store", () => {
  it("maps rows, filters by channel, sorts newest-first, normalizes role", async () => {
    send.mockResolvedValue({
      Items: [
        { SK: "a", channel: "email", name: "Older", role: "captain", vars: { subject: "Hi" }, createdAt: "2026-01-01" },
        { SK: "b", channel: "email", name: "Newer", role: "bogus", vars: {}, createdAt: "2026-02-01" },
        { SK: "c", channel: "sms", name: "A text", role: "admin", vars: { body: "yo" }, createdAt: "2026-03-01" },
        { SK: "d", channel: "email", name: "", vars: {}, createdAt: "2026-04-01" }, // blank name dropped
      ],
    });
    const email = await listSavedTemplates("email");
    expect(email.map((t) => t.name)).toEqual(["Newer", "Older"]); // newest first, blank dropped, sms excluded
    expect(email.find((t) => t.name === "Newer")?.role).toBeNull(); // "bogus" → null
    expect(email.find((t) => t.name === "Older")?.role).toBe("captain");
  });

  it("createSavedTemplate writes channel/name/role/vars and returns an id", async () => {
    send.mockResolvedValue({});
    const id = await createSavedTemplate({ channel: "sms", name: "Promo", role: "donor", vars: { body: "Give today" } });
    expect(id).toBe("newid123");
    const item = (send.mock.calls[0][0] as { input: { Item: Record<string, unknown> } }).input.Item;
    expect(item).toMatchObject({ PK: "MSGTEMPLATE", SK: "newid123", channel: "sms", name: "Promo", role: "donor", vars: { body: "Give today" } });
  });
});
