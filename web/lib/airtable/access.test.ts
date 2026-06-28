import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AirtableRecord } from "@/lib/airtable/client";

// access.ts is a server module (`import "server-only"`); neutralize that marker under vitest.
vi.mock("server-only", () => ({}));

// Drive access.ts with a canned "Front-End Access" control table so we can prove the fail-closed
// semantics, per-op gating, audience matching, and Editable-Fields narrowing — without touching
// Airtable or any secret. listRecords is the only client function access.ts uses.
const listRecords = vi.fn<(...a: unknown[]) => Promise<AirtableRecord[]>>();
vi.mock("@/lib/airtable/client", () => ({
  listRecords: (...a: unknown[]) => listRecords(...a),
}));

import { can, getAccess, filterEditableFields, _clearAccessCache } from "./access";

// Build a control-table record the way Airtable returns it (fields keyed by column NAME;
// singleSelect returns an object with a name).
function row(
  table: string,
  audience: string,
  ops: { c?: boolean; r?: boolean; u?: boolean; d?: boolean },
  editable?: string,
): AirtableRecord {
  return {
    id: `rec_${table}_${audience}`,
    fields: {
      Table: table,
      Audience: { id: "sel", name: audience },
      Create: !!ops.c,
      Read: !!ops.r,
      Update: !!ops.u,
      Delete: !!ops.d,
      ...(editable != null ? { "Editable Fields": editable } : {}),
    },
  };
}

beforeEach(() => {
  _clearAccessCache();
  listRecords.mockReset();
});

describe("access control table", () => {
  it("reads per-op checkboxes for a table × audience", async () => {
    listRecords.mockResolvedValue([
      row("Submissions", "public", { c: true, r: true }),
      row("Submissions", "dashboard", { r: true, u: true, d: true }),
    ]);
    expect(await can("issues", "Submissions", "public", "create")).toBe(true);
    expect(await can("issues", "Submissions", "public", "update")).toBe(false);
    expect(await can("issues", "Submissions", "dashboard", "delete")).toBe(true);
    expect(await can("issues", "Submissions", "dashboard", "create")).toBe(false);
  });

  it("fails closed when the table row is missing", async () => {
    listRecords.mockResolvedValue([row("Submissions", "public", { r: true })]);
    expect(await can("issues", "Nonexistent", "public", "read")).toBe(false);
    const rule = await getAccess("issues", "Nonexistent", "dashboard");
    expect(rule).toMatchObject({ create: false, read: false, update: false, delete: false });
  });

  it("fails closed when the control table is empty / unreadable", async () => {
    listRecords.mockResolvedValue([]); // e.g. PAT lacks access → listRecords returns []
    expect(await can("issues", "Submissions", "public", "read")).toBe(false);
  });

  it("matches audience exactly (public rule never grants dashboard)", async () => {
    listRecords.mockResolvedValue([row("Submissions", "public", { c: true, r: true, u: true, d: true })]);
    expect(await can("issues", "Submissions", "dashboard", "read")).toBe(false);
    expect(await can("issues", "Submissions", "public", "read")).toBe(true);
  });

  it("is case-insensitive on the table name (tolerates Airtable casing)", async () => {
    listRecords.mockResolvedValue([row("Submissions", "public", { r: true })]);
    expect(await can("issues", "submissions", "public", "read")).toBe(true);
  });

  it("narrows writes to Editable Fields; blank = passthrough", async () => {
    listRecords.mockResolvedValue([
      row("Influential Voters", "dashboard", { u: true }, "Outreach Stage, Notes"),
      row("Posts", "dashboard", { c: true, u: true }), // no Editable Fields → all allowed
    ]);
    const narrowed = await filterEditableFields("masterDb", "Influential Voters", "dashboard", {
      "Outreach Stage": "Ask Made",
      Notes: "called",
      Name: "HACK", // not permitted → stripped
    });
    expect(narrowed).toEqual({ "Outreach Stage": "Ask Made", Notes: "called" });

    const passthrough = await filterEditableFields("socialMedia", "Posts", "dashboard", { Title: "x", Status: "Draft" });
    expect(passthrough).toEqual({ Title: "x", Status: "Draft" });
  });

  it("caches within the TTL (one read per base for repeated calls)", async () => {
    listRecords.mockResolvedValue([row("Submissions", "public", { r: true })]);
    await can("issues", "Submissions", "public", "read");
    await can("issues", "Submissions", "public", "read");
    await getAccess("issues", "Submissions", "public");
    expect(listRecords).toHaveBeenCalledTimes(1);
  });
});
