import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseCsvRows, parseCsv, loadCsvManifest } from "@/lib/data/csv";

describe("parseCsvRows (RFC-4180)", () => {
  it("splits simple rows and preserves trailing empty fields", () => {
    expect(parseCsvRows("a,b,c\n1,2,\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", ""],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsvRows('item,note\n"Smith, John","top, donor"\n')).toEqual([
      ["item", "note"],
      ["Smith, John", "top, donor"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsvRows('q\n"she said ""hi"""\n')).toEqual([["q"], ['she said "hi"']]);
  });

  it("handles newlines inside quoted fields", () => {
    expect(parseCsvRows('a\n"line1\nline2"\n')).toEqual([["a"], ["line1\nline2"]]);
  });

  it("normalizes CRLF line endings", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("flushes a final line with no trailing newline", () => {
    expect(parseCsvRows("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsv", () => {
  it("keys items by header and trims values, skipping blank lines", () => {
    const { columns, items } = parseCsv("name,role\n Alice , dev \n\n Bob , pm \n");
    expect(columns).toEqual(["name", "role"]);
    expect(items).toEqual([
      { name: "Alice", role: "dev" },
      { name: "Bob", role: "pm" },
    ]);
  });

  it("matches a naive split for comma-free rows (parity guarantee)", () => {
    const text = "item,category,status\nDonor letter,Correspondence,Not started\n";
    const naive = text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((l) => l.length > 0)
      .slice(1)
      .map((line) => {
        const cells = line.split(",");
        return { item: cells[0].trim(), category: cells[1].trim(), status: cells[2].trim() };
      });
    expect(parseCsv(text).items).toEqual(naive);
  });
});

describe("loadCsvManifest", () => {
  const row = z.object({ item: z.string(), status: z.string() });

  it("returns a typed, validated Resource for a good manifest", () => {
    const manifest = {
      generatedFrom: "x.csv",
      columns: ["item", "status"],
      items: [{ item: "Letterhead", status: "Not started" }],
    };
    const r = loadCsvManifest(manifest, row, { source: "x.csv" });
    expect(r.ok).toBe(true);
    expect(r.meta.kind).toBe("csv");
    expect(r.meta.count).toBe(1);
    if (r.ok) expect(r.data[0].item).toBe("Letterhead");
  });

  it("fails on a malformed manifest", () => {
    const r = loadCsvManifest({ nope: true }, row, { source: "bad.csv" });
    expect(r.ok).toBe(false);
  });

  it("fails when a row violates the schema", () => {
    const manifest = { generatedFrom: "x.csv", columns: ["item", "status"], items: [{ item: "only" }] };
    const r = loadCsvManifest(manifest, row, { source: "x.csv" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/row 0/);
  });
});
