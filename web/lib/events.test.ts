import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DynamoDB layer so we can assert key shapes + idempotency without AWS.
// vi.hoisted so `send` exists when the hoisted vi.mock factory runs.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/db", () => ({
  ddb: { send },
  TABLE: "test-table",
  PK: { events: "EVENT", eventRsvps: "EVENTRSVP" },
  newId: () => "fixed-id",
  dbConfigured: true,
}));
// Force the keyless (DynamoDB) path: listUpcomingEvents/getEvent delegate to the
// Airtable source when getSecret("AIRTABLE_API_KEY") resolves. Without this mock
// these tests pass in CI (no AWS) but FAIL for any dev whose shell has AWS creds,
// since getSecret then pulls the real key from SSM and flips to the Airtable path.
vi.mock("@/lib/ssm", () => ({ getSecret: vi.fn(async () => undefined) }));

import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  createEvent, claimNotify, listUpcomingEvents, toPublicEvent,
  updateEvent, mutateEvent, deleteEvent, setEventStatus, setEventNotify, addSignup,
} from "./events";
import type { EventRow } from "@/lib/events/types";

// Helper: make send answer findRaw's Query with the given raw item(s), everything else {}.
const withItems = (...items: Record<string, unknown>[]) =>
  send.mockImplementation((cmd: { constructor: { name: string } }) =>
    cmd.constructor.name === "QueryCommand" ? Promise.resolve({ Items: items }) : Promise.resolve({}));
// Name-based lookups stay `any` (avoids narrowing to the SDK's optional input types).
const sent = () => send.mock.calls.map((c) => c[0]);
const oneOf = (name: string) => sent().find((c) => c?.constructor?.name === name);
const lastOf = (name: string) => [...sent()].reverse().find((c) => c?.constructor?.name === name);
const anyOf = (name: string) => sent().some((c) => c?.constructor?.name === name);

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

describe("updateEvent (SK move on start change)", () => {
  const oldRaw = {
    id: "e1", PK: "EVENT", SK: "2026-07-12T23:00:00.000Z#e1", start: "2026-07-12T23:00:00.000Z",
    title: "Old", type: "rally", location: { name: "", address: "", city: "Chesterfield", county: "" }, status: "DRAFT",
  };

  it("puts the new item then deletes the old SK when start changes", async () => {
    withItems(oldRaw);
    expect(await updateEvent("e1", { start: "2026-08-01T00:00:00.000Z" })).toBe(true);
    expect(lastOf("PutCommand").input.Item.SK).toBe("2026-08-01T00:00:00.000Z#e1");
    expect(oneOf("DeleteCommand").input.Key.SK).toBe("2026-07-12T23:00:00.000Z#e1");
  });

  it("does not delete when the SK is unchanged", async () => {
    withItems(oldRaw);
    await updateEvent("e1", { title: "New title" });
    expect(anyOf("DeleteCommand")).toBe(false);
  });

  it("edits in place via a targeted update that never rewrites signups or notify claims", async () => {
    withItems(oldRaw);
    await updateEvent("e1", { title: "New title" });
    // No full-item Put — a whole-item overwrite is what used to clobber a concurrent
    // RSVP (permanent signup loss) and reset the at-most-once notify claim.
    expect(anyOf("PutCommand")).toBe(false);
    const upd = oneOf("UpdateCommand");
    expect(upd).toBeTruthy();
    const fields = Object.values(upd.input.ExpressionAttributeNames as Record<string, string>);
    for (const owned of ["signups", "notifiedEmailAt", "notifiedSmsAt", "notifyResult", "createdAt"]) {
      expect(fields).not.toContain(owned); // owned by addSignup/claimNotify — must be untouched
    }
    expect(fields).toContain("title"); // the actual edit is still applied
  });

  it("returns false when the event isn't found", async () => {
    withItems();
    expect(await updateEvent("missing", { title: "x" })).toBe(false);
  });
});

describe("mutateEvent (optimistic concurrency)", () => {
  const raw = {
    id: "e1", PK: "EVENT", SK: "s#e1", start: "2026-07-12T23:00:00.000Z",
    title: "T", type: "rally", location: { name: "", address: "", city: "Chesterfield", county: "" },
    status: "DRAFT", updatedAt: "2026-06-01T00:00:00.000Z", volunteers: [{ id: "v1", name: "Ann" }],
  };

  it("applies the patch and writes a CAS-guarded update that skips signups/notified*", async () => {
    withItems(raw);
    const ok = await mutateEvent("e1", (ev) => ({ volunteers: [...(ev.volunteers ?? []), { id: "v2", name: "Ben" }] }));
    expect(ok).toBe(true);
    const upd = oneOf("UpdateCommand");
    // Compare-and-swap on the updatedAt we read — the guard that covers the caller's read.
    expect(upd.input.ConditionExpression).toContain("#uu");
    expect(upd.input.ExpressionAttributeValues[":uu"]).toBe("2026-06-01T00:00:00.000Z");
    const fields = Object.values(upd.input.ExpressionAttributeNames as Record<string, string>);
    for (const owned of ["signups", "notifiedEmailAt", "notifiedSmsAt", "notifyResult", "createdAt"]) {
      expect(fields).not.toContain(owned);
    }
    expect(fields).toContain("volunteers");
  });

  it("retries on a CAS conflict — re-reads and re-applies to the fresh event, then succeeds", async () => {
    let updates = 0;
    send.mockImplementation((cmd: { constructor: { name: string } }) => {
      const name = cmd.constructor.name;
      if (name === "QueryCommand") return Promise.resolve({ Items: [raw] });
      if (name === "UpdateCommand") {
        updates += 1;
        if (updates === 1) return Promise.reject(Object.assign(new Error("cc"), { name: "ConditionalCheckFailedException" }));
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });
    let applyCalls = 0;
    const ok = await mutateEvent("e1", (ev) => { applyCalls += 1; return { volunteers: ev.volunteers }; });
    expect(ok).toBe(true);
    expect(updates).toBe(2); // first write conflicted, second succeeded
    expect(applyCalls).toBe(2); // apply re-ran against the fresh re-read
  });

  it("returns true and writes nothing when apply returns null (no-op / dedupe)", async () => {
    withItems(raw);
    const ok = await mutateEvent("e1", () => null);
    expect(ok).toBe(true);
    expect(anyOf("UpdateCommand")).toBe(false);
  });

  it("returns false when the event isn't found", async () => {
    withItems();
    expect(await mutateEvent("missing", () => ({ volunteers: [] }))).toBe(false);
  });
});

describe("setEventStatus / deleteEvent / setEventNotify / addSignup", () => {
  const raw = { id: "e1", PK: "EVENT", SK: "s#e1" };

  it("setEventStatus updates status on the resolved SK", async () => {
    withItems(raw);
    expect(await setEventStatus("e1", "PUBLISHED")).toBe(true);
    expect(oneOf("UpdateCommand").input.ExpressionAttributeValues[":s"]).toBe("PUBLISHED");
  });

  it("deleteEvent deletes by the resolved SK", async () => {
    withItems(raw);
    expect(await deleteEvent("e1")).toBe(true);
    expect(oneOf("DeleteCommand").input.Key.SK).toBe("s#e1");
  });

  it("setEventNotify writes the notifyResult", async () => {
    withItems(raw);
    const r = { at: "2026-06-01T00:00:00Z", email: { queued: true }, sms: { queued: false, reason: "none opted in" } };
    expect(await setEventNotify("e1", r)).toBe(true);
    expect(oneOf("UpdateCommand").input.ExpressionAttributeValues[":r"]).toEqual(r);
  });

  it("addSignup appends via list_append and clamps count to 1..20", async () => {
    withItems(raw);
    expect(await addSignup("e1", { name: "Jo", count: 99 })).toBe(true);
    const upd = oneOf("UpdateCommand");
    expect(upd.input.UpdateExpression).toContain("list_append");
    expect(upd.input.ExpressionAttributeValues[":s"][0]).toMatchObject({ name: "Jo", count: 20 });
  });

  it("addSignup persists an RSVP for a non-DynamoDB (Airtable) event", async () => {
    withItems(); // no matching DynamoDB event → Airtable-sourced path
    expect(await addSignup("airtable-rec", { name: "Jo" })).toBe(true);
    const put = oneOf("PutCommand");
    expect(put.input.Item.PK).toBe("EVENTRSVP");
    expect(put.input.Item).toMatchObject({ eventId: "airtable-rec", name: "Jo" });
  });
});

describe("toPublicEvent", () => {
  it("strips signup PII to aggregate counts", () => {
    const e = {
      id: "e", title: "T", type: "rally", start: "2026-07-12T23:00:00.000Z", end: null,
      location: { name: "", address: "", city: "", county: "" }, lat: null, lng: null, districtKey: "district:mo-02",
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
