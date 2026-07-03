import { describe, it, expect } from "vitest";
import { nextSort, groupRows, csvField, toCsv, exportCsv, type ExportColumn } from "./view";
import type { ColumnDef, QueryState } from "./types";

const base: QueryState = { q: "", facets: {}, sort: "amount", dir: "desc" };

describe("nextSort", () => {
  it("flips direction when the active column is clicked again", () => {
    expect(nextSort(base, "amount")).toEqual({ sort: "amount", dir: "asc" });
    expect(nextSort({ ...base, dir: "asc" }, "amount")).toEqual({ sort: "amount", dir: "desc" });
  });
  it("selects a new column ascending", () => {
    expect(nextSort(base, "name")).toEqual({ sort: "name", dir: "asc" });
  });
});

describe("groupRows", () => {
  type R = { cat: string; n: number };
  const rows: R[] = [
    { cat: "b", n: 1 },
    { cat: "a", n: 2 },
    { cat: "b", n: 3 },
    { cat: "c", n: 4 },
  ];
  it("orders groups by the given order, preserving row order within each", () => {
    const out = groupRows(rows, (r) => r.cat, ["a", "b"]);
    expect(out.map(([k]) => k)).toEqual(["a", "b", "c"]); // a,b first; c appended
    expect(out.find(([k]) => k === "b")![1].map((r) => r.n)).toEqual([1, 3]);
  });
  it("appends unlisted groups in first-seen order when no order given", () => {
    expect(groupRows(rows, (r) => r.cat).map(([k]) => k)).toEqual(["b", "a", "c"]);
  });
  it("omits groups with no rows", () => {
    expect(groupRows(rows, (r) => r.cat, ["a", "z", "b"]).map(([k]) => k)).toEqual(["a", "b", "c"]);
  });
});

describe("csvField", () => {
  it("leaves plain values unquoted", () => {
    expect(csvField("hello")).toBe("hello");
  });
  it("quotes and escapes values with commas, quotes, or newlines", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  type R = { name: string; amt: number };
  const columns: ColumnDef<R>[] = [
    { key: "name", header: "Name", cell: (r) => r.name, csv: (r) => r.name },
    { key: "amt", header: "Amount", cell: (r) => r.amt, csv: (r) => String(r.amt) },
    { key: "action", header: "", cell: () => null }, // no csv → excluded
  ];
  it("emits a header row + one line per row, skipping columns without csv", () => {
    const out = toCsv(columns, [{ name: "Ada, L", amt: 5 }], {});
    expect(out).toBe('Name,Amount\r\n"Ada, L",5');
  });
  it("returns empty string when no column exports", () => {
    expect(toCsv([{ key: "x", header: "X", cell: () => null }], [{ name: "a", amt: 1 }], {})).toBe("");
  });
});

describe("exportCsv (explicit columns override)", () => {
  type R = { a: string; b: string };
  const cols: ExportColumn<R>[] = [
    { header: "A", value: (r) => r.a },
    { header: "B", value: (r) => r.b },
  ];
  it("exports the given fields regardless of visible columns, with quoting", () => {
    const out = exportCsv(cols, [{ a: "x", b: 'has "quote"' }], {});
    expect(out).toBe('A,B\r\nx,"has ""quote"""');
  });
  it("returns empty string for no columns", () => {
    expect(exportCsv([], [{ a: "x", b: "y" }], {})).toBe("");
  });
});
