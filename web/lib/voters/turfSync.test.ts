import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Airtable layers so the sync logic is testable without a network:
// the client records what it was asked to write; access is toggled per test.
const calls = {
  created: [] as { fields: Record<string, unknown> }[],
  updated: [] as { id: string; fields: Record<string, unknown> }[],
  existing: [] as { id: string; fields: Record<string, unknown> }[],
};
let allow = { create: true, update: true };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/airtable/client", () => ({
  listRecords: vi.fn(async () => calls.existing),
  createRecords: vi.fn(async (_b: string, _t: string, recs: { fields: Record<string, unknown> }[]) => {
    calls.created.push(...recs);
    return recs;
  }),
  updateRecords: vi.fn(async (_b: string, _t: string, recs: { id: string; fields: Record<string, unknown> }[]) => {
    calls.updated.push(...recs);
    return recs;
  }),
  AirtableNotConfiguredError: class extends Error {},
}));
vi.mock("@/lib/airtable/access", () => ({
  can: vi.fn(async (_b: string, _t: string, _a: string, op: "create" | "update") => allow[op as "create" | "update"] ?? false),
  filterEditableFields: vi.fn(async (_b: string, _t: string, _a: string, fields: Record<string, unknown>) => fields),
}));

import { callListName, syncCallList, syncTurfs, turfName } from "./turfSync";

beforeEach(() => {
  calls.created = [];
  calls.updated = [];
  calls.existing = [];
  allow = { create: true, update: true };
});

describe("syncTurfs", () => {
  const input = {
    precinctLabel: "Queeny 12",
    filtersLabel: "segment=PERSUADE",
    turfs: [
      { index: 1, total: 2, doors: 52, voters: 104, captainName: "Ann" },
      { index: 2, total: 2, doors: 48, voters: 90 },
    ],
  };

  it("creates rows with deterministic names, counts, and NO voter PII", async () => {
    const res = await syncTurfs(input);
    expect(res).toEqual({ ok: true, created: 2, updated: 0 });
    expect(calls.created[0].fields["Turf Name"]).toBe(turfName("Queeny 12", 1, 2));
    expect(calls.created[0].fields).toMatchObject({
      "Pass Type": "Voter ID",
      Doors: 52,
      "Registered Voters": 104,
      "Walk Status": "Assigned",
      "Assigned Captain": "Ann",
    });
    expect(calls.created[1].fields["Walk Status"]).toBe("Unassigned");
    // Privacy boundary: only counts/labels — never names/addresses of voters.
    const written = JSON.stringify(calls.created);
    expect(written).not.toMatch(/address|firstName|lastName|voterId/i);
    expect(String(calls.created[0].fields.Notes)).toContain("RSMo 115.157");
  });

  it("updates an existing row by name and never touches Walk Status on update", async () => {
    calls.existing = [{ id: "rec1", fields: { "Turf Name": turfName("Queeny 12", 1, 2) } }];
    const res = await syncTurfs(input);
    expect(res).toEqual({ ok: true, created: 1, updated: 1 });
    expect(calls.updated[0].id).toBe("rec1");
    expect(calls.updated[0].fields["Walk Status"]).toBeUndefined();
    expect(calls.updated[0].fields.Doors).toBe(52);
  });

  it("reports fail-closed governance honestly instead of throwing", async () => {
    allow = { create: false, update: false };
    const res = await syncTurfs(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("Front-End Access");
    expect(calls.created).toEqual([]);
  });
});

describe("syncCallList", () => {
  it("upserts one Contact Lists row keyed by the precinct", async () => {
    const res = await syncCallList({ precinctLabel: "Queeny 12", filtersLabel: "all voters", records: 17 });
    expect(res).toEqual({ ok: true, created: 1, updated: 0 });
    expect(calls.created[0].fields["List Name"]).toBe(callListName("Queeny 12"));
    expect(calls.created[0].fields).toMatchObject({ Channel: "Phone", Records: 17, Status: "Unassigned" });
  });
});
