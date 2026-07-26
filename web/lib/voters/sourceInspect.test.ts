import { describe, expect, it } from "vitest";
import {
  EXCEL_ROW_CAP,
  classify,
  dominantKind,
  isMasked,
  looksTruncated,
  makeCsvParser,
  newCol,
  observe,
  renderReport,
  sniffDelimiter,
  type ScanResult,
} from "./sourceInspect";

// Fixtures here are SYNTHETIC — never real voter rows (candidate/voter-file-plan.md §2).

const parseAll = (text: string, delimiter = ",", chunkSize = Number.POSITIVE_INFINITY): string[][] => {
  const rows: string[][] = [];
  const p = makeCsvParser(delimiter, (r) => rows.push(r));
  for (let i = 0; i < text.length; i += chunkSize) p.write(text.slice(i, i + chunkSize));
  p.end();
  return rows;
};

describe("makeCsvParser", () => {
  it("parses a plain file", () => {
    expect(parseAll("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted delimiters, escaped quotes, and embedded newlines", () => {
    const rows = parseAll('a,b,c\n"x,1","he said ""hi""","line1\nline2"\n');
    expect(rows[1]).toEqual(["x,1", 'he said "hi"', "line1\nline2"]);
  });

  it("treats a quote mid-field as a literal, not an opener", () => {
    // Vendor exports often leave unquoted values like: 123 "Main" St
    expect(parseAll('a\n123 "Main" St\n')[1]).toEqual(['123 "Main" St']);
  });

  it("survives chunk boundaries splitting a %s escape", () => {
    const text = 'a,b\n"x""y",2\n';
    // Byte-at-a-time is the worst case: the "" escape straddles every boundary.
    expect(parseAll(text, ",", 1)).toEqual([
      ["a", "b"],
      ['x"y', "2"],
    ]);
  });

  it("emits the final row when the file has no trailing newline", () => {
    expect(parseAll("a,b\n1,2")).toHaveLength(2);
  });

  it("ignores the blank row produced by a trailing newline", () => {
    expect(parseAll("a\n1\n\n")).toEqual([["a"], ["1"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseAll("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("respects a non-comma delimiter", () => {
    expect(parseAll("a\tb\n1\t2\n", "\t")[1]).toEqual(["1", "2"]);
  });

  it("emits nothing for an empty file", () => {
    expect(parseAll("")).toEqual([]);
  });
});

describe("sniffDelimiter", () => {
  it("picks the delimiter that appears most outside quotes", () => {
    expect(sniffDelimiter("a,b,c\n")).toBe(",");
    expect(sniffDelimiter("a\tb\tc\n")).toBe("\t");
    expect(sniffDelimiter("a|b|c\n")).toBe("|");
  });

  it("is not fooled by delimiters inside a quoted header", () => {
    expect(sniffDelimiter('"last,first"\tzip\n')).toBe("\t");
  });
});

describe("classify", () => {
  it("recognizes the shapes a voter export carries", () => {
    expect(classify("")).toBe("empty");
    expect(classify("63011")).toBe("zip5");
    expect(classify("63011-1234")).toBe("zip9");
    expect(classify("1974")).toBe("year");
    expect(classify("MO")).toBe("state");
    expect(classify("Y")).toBe("boolean");
    expect(classify("42")).toBe("integer");
    expect(classify("3.14")).toBe("decimal");
    expect(classify("11/05/2024")).toBe("date");
    expect(classify("2024-11-05")).toBe("date");
    expect(classify("(314) 555-1234")).toBe("phone");
    expect(classify("someone@example.com")).toBe("email");
    expect(classify("St. Louis")).toBe("text");
  });

  it("does not mistake a 1/0 flag for a boolean it would then unmask", () => {
    // 1 and 0 classify as integers; that keeps numeric ranges meaningful.
    expect(classify("1")).toBe("integer");
  });
});

describe("isMasked", () => {
  it("masks personal data by header", () => {
    expect(isMasked("FirstName", "text")).toBe(true);
    expect(isMasked("LastName", "text")).toBe(true);
    expect(isMasked("AddressLine1", "text")).toBe(true);
    expect(isMasked("Email", "text")).toBe(true);
    expect(isMasked("DOB", "text")).toBe(true);
  });

  it("masks personal data by value shape even when the header is innocuous", () => {
    expect(isMasked("col_17", "phone")).toBe(true);
    expect(isMasked("col_18", "email")).toBe(true);
  });

  it("does NOT mask geography that merely contains the word name", () => {
    // These distinct sets are the most useful part of the report.
    expect(isMasked("CountyName", "text")).toBe(false);
    expect(isMasked("PrecinctName", "text")).toBe(false);
  });

  it("does NOT mask category descriptors", () => {
    expect(isMasked("PhoneType", "text")).toBe(false);
    expect(isMasked("LineType", "text")).toBe(false);
    expect(isMasked("PartyCode", "text")).toBe(false);
  });

  it("does NOT mask a bare birth year (coarse, and the range is useful)", () => {
    expect(isMasked("BirthYear", "year")).toBe(false);
  });
});

describe("observe / dominantKind", () => {
  it("tracks fill, length, and numeric range", () => {
    const c = newCol("PartisanScore", 0);
    for (const v of ["10.5", "99.25", "", "1.0"]) observe(c, v, 30);
    expect(c.nonEmpty).toBe(3);
    expect(c.numericMin).toBe(1);
    expect(c.numericMax).toBe(99.25);
    expect(dominantKind(c)).toBe("decimal");
  });

  it("reports an all-empty column as empty", () => {
    const c = newCol("Unused", 0);
    observe(c, "", 30);
    observe(c, "   ", 30);
    expect(c.nonEmpty).toBe(0);
    expect(dominantKind(c)).toBe("empty");
  });

  it("stops retaining values once a column proves high-cardinality", () => {
    const c = newCol("VoterID", 0);
    for (let i = 0; i < 500; i++) observe(c, `ID${i}`, 5);
    expect(c.distinctOverflow).toBe(true);
    // The whole point: real values are not held in memory or renderable.
    expect(c.distinct.size).toBe(0);
  });
});

describe("looksTruncated", () => {
  it("flags a row count at or near Excel's cap", () => {
    expect(looksTruncated(EXCEL_ROW_CAP, true)).toBe(true);
    expect(looksTruncated(EXCEL_ROW_CAP - 10, true)).toBe(true);
  });

  it("does not flag a comfortably smaller file", () => {
    expect(looksTruncated(577_366, true)).toBe(false);
  });

  it("never claims truncation when the count is not exact", () => {
    expect(looksTruncated(EXCEL_ROW_CAP, false)).toBe(false);
  });
});

describe("renderReport", () => {
  const build = (headers: string[], rows: string[][], overrides: Partial<ScanResult> = {}): string => {
    const cols = headers.map((h, i) => newCol(h, i));
    for (const row of rows) for (let i = 0; i < cols.length; i++) observe(cols[i], row[i] ?? "", 30);
    const result: ScanResult = {
      headers,
      cols,
      totalRows: rows.length,
      sampledRows: rows.length,
      raggedRows: 0,
      exactCount: true,
      delimiter: ",",
      ...overrides,
    };
    return renderReport("export.csv", result, 30);
  };

  it("never leaks a masked column's values", () => {
    const out = build(
      ["FirstName", "CellPhone", "CountyName"],
      [
        ["Ann", "3145551234", "Franklin"],
        ["Bob", "3145555678", "Franklin"],
      ],
    );
    expect(out).not.toContain("Ann");
    expect(out).not.toContain("3145551234");
    expect(out).toContain("_withheld (personal data)_");
    // ...while still surfacing the geography that makes the report useful.
    expect(out).toContain("`Franklin`");
  });

  it("warns that phones are call-only when a phone column is present", () => {
    const out = build(["CellPhone"], [["3145551234"]]);
    expect(out).toContain("manual-dial and P2P only");
  });

  it("warns when no voter-ID join key is detected", () => {
    const out = build(["CountyName"], [["Franklin"]]);
    expect(out).toContain("No obvious voter-ID column");
  });

  it("stays quiet about the join key when a voter ID is present", () => {
    const out = build(["StateVoterID", "CountyName"], [["MO1", "Franklin"]]);
    expect(out).not.toContain("No obvious voter-ID column");
  });

  it("surfaces the truncation warning at Excel's cap", () => {
    const out = build(["a"], [["1"]], { totalRows: EXCEL_ROW_CAP, exactCount: true });
    expect(out).toContain("TRUNCATION WARNING");
  });

  it("says the count is inexact rather than claiming a clean bill of health", () => {
    const out = build(["a"], [["1"]], { exactCount: false });
    expect(out).toContain("Row count is not exact");
  });

  it("escapes pipes and newlines so the markdown table survives", () => {
    const out = build(["Note"], [["a|b"], ["c\nd"]]);
    expect(out).toContain("a\\|b");
    expect(out).toContain("c⏎d");
  });
});
