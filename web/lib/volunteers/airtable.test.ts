import { describe, it, expect, vi, beforeEach } from "vitest";

// The Airtable Volunteers mirror: verify the upsert chooses CREATE vs UPDATE on the
// presence of a record id, that an UPDATE never clobbers admin-owned Status/Signed Up,
// and that the status-sync maps + no-ops correctly. The transport + access layers are
// mocked so this stays hermetic.
// airtable.ts is a server module (`import "server-only"`); neutralize that under vitest.
vi.mock("server-only", () => ({}));

const createRecords = vi.fn();
const updateRecords = vi.fn();
const listRecords = vi.fn();
vi.mock("@/lib/airtable/client", () => ({
  createRecords: (...a: unknown[]) => createRecords(...a),
  updateRecords: (...a: unknown[]) => updateRecords(...a),
  listRecords: (...a: unknown[]) => listRecords(...a),
}));
vi.mock("@/lib/airtable/access", () => ({
  can: vi.fn().mockResolvedValue(true),
  filterEditableFields: (_b: unknown, _t: unknown, _a: unknown, f: Record<string, unknown>) => f, // passthrough
}));

import { mirrorVolunteerToAirtable, mirrorVolunteerStatusToAirtable, _clearLinkCache } from "./airtable";

const base = { name: "Dana", door: "Volunteer" as const, signedUpDate: "2026-06-28" };

beforeEach(() => {
  createRecords.mockReset().mockResolvedValue([{ id: "recNEW" }]);
  updateRecords.mockReset().mockResolvedValue([{ id: "recOLD" }]);
  listRecords.mockReset().mockResolvedValue([]); // no link lookups needed
  _clearLinkCache();
});

describe("mirrorVolunteerToAirtable upsert", () => {
  it("CREATEs a new row (with Status=New) when no record id is given", async () => {
    const id = await mirrorVolunteerToAirtable(base);
    expect(id).toBe("recNEW");
    expect(updateRecords).not.toHaveBeenCalled();
    const fields = createRecords.mock.calls[0][2][0].fields as Record<string, unknown>;
    expect(fields.Status).toBe("New");
    expect(fields["Signed Up"]).toBe("2026-06-28");
  });

  it("UPDATEs the existing row and does NOT touch Status / Signed Up", async () => {
    const id = await mirrorVolunteerToAirtable(base, "recOLD");
    expect(id).toBe("recOLD");
    expect(createRecords).not.toHaveBeenCalled();
    const arg = updateRecords.mock.calls[0][2][0] as { id: string; fields: Record<string, unknown> };
    expect(arg.id).toBe("recOLD");
    expect(arg.fields.Status).toBeUndefined();
    expect(arg.fields["Signed Up"]).toBeUndefined();
    expect(arg.fields.Name).toBe("Dana");
  });
});

describe("mirrorVolunteerStatusToAirtable", () => {
  it("maps the dashboard status and PATCHes the row", async () => {
    await mirrorVolunteerStatusToAirtable("recX", "ACTIVE");
    expect(updateRecords.mock.calls[0][2][0]).toEqual({ id: "recX", fields: { Status: "Active" } });
  });

  it("no-ops without a record id", async () => {
    await mirrorVolunteerStatusToAirtable(null, "ACTIVE");
    expect(updateRecords).not.toHaveBeenCalled();
  });

  it("ignores an unknown status", async () => {
    await mirrorVolunteerStatusToAirtable("recX", "BOGUS");
    expect(updateRecords).not.toHaveBeenCalled();
  });
});
