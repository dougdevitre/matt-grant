import { describe, expect, it } from "vitest";
import { mapAppendRows } from "./phoneAppend";
import { parseCsv } from "@/lib/contacts/import";

// SYNTHETIC fixtures only — never real voter rows.
describe("mapAppendRows", () => {
  it("maps header aliases and keeps voterId-keyed and name+zip-keyed rows", () => {
    const rows = parseCsv(
      [
        "Voter ID,Full Name,Zip Code,Cell,Vendor",
        'V001,"Sample, Alex",63011,(314) 555-0100,vendor-x',
        ',"Sample, Blake",63021-4455,314.555.0101,',
      ].join("\n"),
    );
    const res = mapAppendRows(rows, "fallback-src");
    expect(res.total).toBe(2);
    expect(res.skipped).toEqual([]);
    expect(res.valid[0]).toEqual({
      voterId: "V001",
      name: "Sample, Alex",
      zip: "63011",
      phone: "(314) 555-0100",
      source: "vendor-x",
    });
    // ZIP+4 truncates to ZIP5; blank source falls back.
    expect(res.valid[1]).toEqual({
      name: "Sample, Blake",
      zip: "63021",
      phone: "314.555.0101",
      source: "fallback-src",
    });
    expect(res.mappedColumns).toEqual(["voterId", "name", "zip", "phone", "source"]);
  });

  it("skips rows without a usable phone or without any usable key, with reasons", () => {
    const rows = parseCsv(
      [
        "voter_id,name,zip,phone",
        "V001,,,555", // phone too short
        ',"Sample, Casey",630,3145550102', // zip not 5 digits, no voterId
        ',,,3145550103', // no key at all
      ].join("\n"),
    );
    const res = mapAppendRows(rows);
    expect(res.valid).toEqual([]);
    expect(res.skipped.map((s) => s.reason)).toEqual([
      "no usable phone",
      "needs a Voter ID or a name + 5-digit ZIP",
      "needs a Voter ID or a name + 5-digit ZIP",
    ]);
  });

  it("returns empty on a header-only or empty paste", () => {
    expect(mapAppendRows(parseCsv("voter_id,phone")).valid).toEqual([]);
    expect(mapAppendRows([]).total).toBe(0);
  });
});
