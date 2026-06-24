import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DynamoDB layer so we can assert key shapes + idempotency without AWS.
// vi.hoisted so `send` exists when the hoisted vi.mock factory runs.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/db", () => ({
  ddb: { send },
  TABLE: "test-table",
  PK: { events: "EVENT" },
  newId: () => "fixed-id",
  dbConfigured: true,
}));

import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createEvent, claimNotify, listUpcomingEvents, toPublicEvent } from "./events";
import type { EventRow } from "@/lib/events/types";

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({});
});

describe("createEvent", () => {
  it("keys SK as `${startISO}#${id}` and defaults to a DRAFT, resolving the district", async () => {
    const start = "2026-07-12T23:00:00.000Z";
    const id = await createEvent({
      title: "Town Hall",
      type: "town-hall",
      start,
      location: { name: "Library", address: "", city: "Chesterfield", county: "" },
      description: "",
      createdBy: "me@x.org",
    });
    const cmd = send.mock.calls.at(-1)![0];
    expect(cmd).toBeInstanceOf(PutCommand);
    expect(cmd.input.Item.SK).toBe(`${start}#${id}`);
    expect(cmd.input.Item.status).toBe("DRAFT");
    expect(cmd.input.Item.districtKey).toBe("place:chesterfield");
  });
});

describe("claimNotify (idempotent per channel)", () => {
  it("returns true the first time and false once already claimed", async () => {
    let updates = 0;
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === "QueryCommand") return Promise.resolve({ Items: [{ id: "e1", SK: "2026-07-12T23:00:00.000Z#e1", PK: "EVENT" }] });
      if (name === "UpdateCommand") {
        updates += 1;
        if (updates === 1) return Promise.resolve({});
        const err = Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
        return Promise.reject(err);
      }
      return Promise.resolve({});
    });
    expect(await claimNotify("e1", "Email")).toBe(true);
    expect(await claimNotify("e1", "Email")).toBe(false);
  });
});

describe("listUpcomingEvents", () => {
  it("queries by SK >= now and filters out cancelled / non-published", async () => {
    send.mockResolvedValueOnce({
      Items: [
        { id: "a", SK: "2026-07-12T00:00:00.000Z#a", start: "2026-07-12T00:00:00.000Z", status: "PUBLISHED", title: "Pub" },
        { id: "b", SK: "2026-07-13T00:00:00.000Z#b", start: "2026-07-13T00:00:00.000Z", status: "DRAFT", title: "Draft" },
        { id: "c", SK: "2026-07-14T00:00:00.000Z#c", start: "2026-07-14T00:00:00.000Z", status: "CANCELLED", title: "Cxl" },
      ],
    });
    const rows = await listUpcomingEvents({ publishedOnly: true });
    expect(rows.map((r) => r.id)).toEqual(["a"]);
    const cmd = send.mock.calls.at(-1)![0];
    expect(cmd).toBeInstanceOf(QueryCommand);
    expect(cmd.input.KeyConditionExpression).toContain("SK >= :now");
  });
});

describe("toPublicEvent", () => {
  it("strips signup PII to aggregate counts", () => {
    const e = {
      id: "e", title: "T", type: "rally", start: "2026-07-12T23:00:00.000Z", end: null,
      location: { name: "", address: "", city: "", county: "" }, districtKey: "district:mo-02",
      description: "", status: "PUBLISHED", capacity: 10,
      signups: [
        { id: "1", name: "A", email: "a@x.org", phone: null, role: null, count: 2, createdAt: "" },
        { id: "2", name: "B", email: null, phone: "+1", role: null, count: 1, createdAt: "" },
      ],
      source: "manual", parseConfidence: null, notifiedEmailAt: null, notifiedSmsAt: null,
      createdBy: "x", createdAt: "", updatedAt: null,
    } as EventRow;
    const pub = toPublicEvent(e);
    expect(pub.signupCount).toBe(2);
    expect(pub.goingCount).toBe(3);
    expect(pub).not.toHaveProperty("signups");
    expect(JSON.stringify(pub)).not.toContain("a@x.org");
  });
});
