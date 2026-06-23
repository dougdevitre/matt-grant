import { describe, it, expect } from "vitest";
import { parseCsv, mapVolunteers, mapDonors } from "@/lib/contacts/import";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("handles quoted fields with commas and newlines", () => {
    const out = parseCsv('name,note\n"Doe, Jane","line1\nline2"');
    expect(out).toEqual([["name", "note"], ["Doe, Jane", "line1\nline2"]]);
  });
  it("handles escaped quotes and CRLF, and drops blank lines", () => {
    const out = parseCsv('a\r\n"he said ""hi"""\r\n\r\n');
    expect(out).toEqual([["a"], ['he said "hi"']]);
  });
});

describe("mapVolunteers", () => {
  it("maps recognized headers in any order/case and requires name + contact", () => {
    const rows = parseCsv("Full Name,Email,Phone,City,Interests\nJane Doe,JANE@x.com,314-555-0100,Kirkwood,canvass;phones\nNo Contact,,,Town,signs");
    const r = mapVolunteers(rows);
    expect(r.valid).toHaveLength(1);
    expect(r.skipped).toBe(1); // "No Contact" has neither email nor phone
    expect(r.valid[0]).toEqual({ name: "Jane Doe", email: "jane@x.com", phone: "314-555-0100", city: "Kirkwood", interests: "canvass;phones" });
    expect(r.mappedColumns.sort()).toEqual(["city", "email", "interests", "name", "phone"]);
  });

  it("accepts a phone-only row (no email)", () => {
    const r = mapVolunteers(parseCsv("name,phone\nSam Lee,3145550100"));
    expect(r.valid).toEqual([{ name: "Sam Lee", phone: "3145550100" }]);
  });

  it("returns nothing usable when no known columns are present", () => {
    const r = mapVolunteers(parseCsv("foo,bar\n1,2"));
    expect(r.valid).toHaveLength(0);
    expect(r.mappedColumns).toEqual([]);
  });
});

describe("mapDonors", () => {
  it("requires a name and parses amount ($/commas) to cents", () => {
    const rows = parseCsv("Donor Name,Email,Employer,Occupation,Amount\nJane Doe,JANE@x.com,Acme Inc,Engineer,\"$1,250.50\"\n,nobody@x.com,,,50");
    const r = mapDonors(rows);
    expect(r.valid).toHaveLength(1);
    expect(r.skipped).toBe(1); // missing name
    expect(r.valid[0]).toMatchObject({ name: "Jane Doe", email: "jane@x.com", employer: "Acme Inc", occupation: "Engineer", amountCents: 125050 });
  });

  it("allows a donor with no amount (contact-only import)", () => {
    const r = mapDonors(parseCsv("name,email\nSam Lee,sam@x.com"));
    expect(r.valid).toEqual([{ name: "Sam Lee", email: "sam@x.com", amountCents: undefined }]);
  });
});
