import { describe, it, expect, vi, beforeEach } from "vitest";

const { send, queryAllPages } = vi.hoisted(() => ({ send: vi.fn(), queryAllPages: vi.fn() }));
vi.mock("@/lib/db", () => ({
  ddb: { send },
  TABLE: "test-table",
  newId: () => "fixed-id",
  dbConfigured: true,
  queryAllPages: (...args: unknown[]) => queryAllPages(...args),
}));

import { recordAccessChange, listAccessChanges, recordPreviewSwitch, listPreviewSwitches, recordExtAction, listExtActions, extAdoptionSummary } from "./audit";

const entry = {
  at: "2026-06-24T05:00:00.000Z",
  actor: "admin@x.org",
  target: "staffer@x.org",
  action: "role_change" as const,
  role: "editor",
  prevRole: "viewer",
};

beforeEach(() => {
  vi.clearAllMocks();
  send.mockResolvedValue({});
});

describe("recordAccessChange", () => {
  it("writes under the access partition with a sortable `${at}#id` key", async () => {
    const at = "2026-06-24T05:00:00.000Z";
    await recordAccessChange({ ...entry, at });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe("AUDIT#access");
    expect(item.SK).toBe(`${at}#fixed-id`);
    expect(item.action).toBe("role_change");
    expect(item.actor).toBe("admin@x.org");
  });

  it("never throws if the write fails (audit is best-effort)", async () => {
    send.mockRejectedValue(new Error("ddb down"));
    await expect(recordAccessChange({ ...entry, at: "2026-06-24T05:00:00.000Z" })).resolves.toBeUndefined();
  });
});

describe("listAccessChanges", () => {
  it("queries newest-first with the requested limit and maps rows", async () => {
    send.mockResolvedValue({
      Items: [{ at: "2026-06-24T05:00:00.000Z", actor: "a", target: "b", action: "invite", role: "viewer" }],
    });
    const rows = await listAccessChanges(10);
    const q = send.mock.calls[0][0].input;
    expect(q.ScanIndexForward).toBe(false); // descending → newest first
    expect(q.Limit).toBe(10);
    expect(q.ExpressionAttributeValues).toEqual({ ":p": "AUDIT#access" });
    expect(rows).toEqual([{ at: "2026-06-24T05:00:00.000Z", actor: "a", target: "b", action: "invite", role: "viewer", prevRole: undefined }]);
  });

  it("returns [] on a query failure rather than throwing", async () => {
    send.mockRejectedValue(new Error("boom"));
    expect(await listAccessChanges()).toEqual([]);
  });
});

describe("preview switch stream (separate partition)", () => {
  it("recordPreviewSwitch writes under AUDIT#preview with a sortable key", async () => {
    const at = "2026-06-24T06:00:00.000Z";
    await recordPreviewSwitch({ at, actor: "admin@x.org", target: "admin@x.org", action: "preview_enter", role: "volunteer" });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe("AUDIT#preview"); // NOT the access partition
    expect(item.SK).toBe(`${at}#fixed-id`);
    expect(item.action).toBe("preview_enter");
    expect(item.role).toBe("volunteer");
  });

  it("listPreviewSwitches queries the preview partition newest-first", async () => {
    send.mockResolvedValue({
      Items: [{ at: "2026-06-24T06:00:00.000Z", actor: "admin@x.org", target: "admin@x.org", action: "preview_exit", role: "supporter" }],
    });
    const rows = await listPreviewSwitches(10);
    const q = send.mock.calls[0][0].input;
    expect(q.ScanIndexForward).toBe(false);
    expect(q.Limit).toBe(10);
    expect(q.ExpressionAttributeValues).toEqual({ ":p": "AUDIT#preview" });
    expect(rows[0]).toMatchObject({ action: "preview_exit", role: "supporter" });
  });

  it("is best-effort: a write failure never throws", async () => {
    send.mockRejectedValue(new Error("ddb down"));
    await expect(
      recordPreviewSwitch({ at: "2026-06-24T06:00:00.000Z", actor: "a", target: "a", action: "preview_enter", role: "volunteer" }),
    ).resolves.toBeUndefined();
  });
});


describe("extension audit trail (AUDIT#ext)", () => {
  it("recordExtAction writes the ext-shaped row under AUDIT#ext", async () => {
    const at = "2026-07-01T12:00:00.000Z";
    await recordExtAction({ at, actor: "cap@x.org", action: "task.create", target: "t1" });
    const item = send.mock.calls[0][0].input.Item;
    expect(item.PK).toBe("AUDIT#ext");
    expect(item.SK).toBe(`${at}#fixed-id`);
    expect(item.action).toBe("task.create");
    expect(item.target).toBe("t1");
  });

  it("listExtActions queries AUDIT#ext newest-first and maps the ext fields", async () => {
    send.mockResolvedValue({
      Items: [{ at: "2026-07-01T12:00:00.000Z", actor: "cap@x.org", action: "event.update", target: "e9" }],
    });
    const rows = await listExtActions(15);
    const q = send.mock.calls[0][0].input;
    expect(q.ScanIndexForward).toBe(false);
    expect(q.Limit).toBe(15);
    expect(q.ExpressionAttributeValues).toEqual({ ":p": "AUDIT#ext" });
    expect(rows).toEqual([{ at: "2026-07-01T12:00:00.000Z", actor: "cap@x.org", action: "event.update", target: "e9" }]);
  });

  it("extAdoptionSummary groups by actor, counts, and flags 7-day activity", async () => {
    const now = new Date("2026-07-10T00:00:00.000Z");
    queryAllPages.mockResolvedValue([
      { actor: "cap@x.org", at: "2026-07-09T10:00:00.000Z", action: "task.create", target: "t1" }, // within 7d
      { actor: "cap@x.org", at: "2026-07-08T10:00:00.000Z", action: "task.status", target: "t1" },
      { actor: "old@x.org", at: "2026-06-01T10:00:00.000Z", action: "issue.status", target: "i1" }, // stale
    ]);
    const sum = await extAdoptionSummary(now);
    expect(sum.totalActions).toBe(3);
    expect(sum.activeLast7d).toBe(1); // only cap@x.org acted in the last 7 days
    expect(sum.perActor[0]).toEqual({ actor: "cap@x.org", count: 2, lastAt: "2026-07-09T10:00:00.000Z" });
    // sorted most-recently-active first
    expect(sum.perActor.map((a) => a.actor)).toEqual(["cap@x.org", "old@x.org"]);
  });

  it("extAdoptionSummary returns empty on a read failure rather than throwing", async () => {
    queryAllPages.mockRejectedValue(new Error("scan boom"));
    expect(await extAdoptionSummary(new Date("2026-07-10T00:00:00.000Z"))).toEqual({ perActor: [], activeLast7d: 0, totalActions: 0 });
  });
});
