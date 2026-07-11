import { describe, expect, it } from "vitest";
import { matchPhones } from "./phones";
import type { StoredVoter } from "./storeTypes";

// SYNTHETIC fixtures only — never real voter rows.
const voter = (voterId: string, firstName: string, lastName: string, zip: string): StoredVoter => ({
  voterId,
  firstName,
  lastName,
  address: "1 Main St",
  city: "Ballwin",
  zip,
  county: "St. Louis",
  precinctName: "Sample 1",
  yob: 1980,
  active: true,
  lastVoted: null,
  t: 3,
  s: 1,
  segment: "PROSPECT",
  newRegistrant: false,
});

describe("matchPhones", () => {
  it("matches on full name + ZIP5, case/punctuation-insensitive", () => {
    const phones = matchPhones(
      [voter("V1", "Ann", "O'Hara", "63011")],
      [{ name: "ann o hara", zip: "63011-1234", phone: "+13145550100" }],
    );
    expect(phones).toEqual({ V1: "+13145550100" });
  });

  it("never matches across ZIPs, without a phone, or with a short zip", () => {
    const phones = matchPhones(
      [voter("V1", "Ann", "Hara", "63011"), voter("V2", "Bo", "Lee", "630")],
      [
        { name: "Ann Hara", zip: "63021", phone: "555" }, // different zip
        { name: "Ann Hara", zip: "63011", phone: "" }, // no phone
        { name: "Bo Lee", zip: "630", phone: "555" }, // malformed zip
      ],
    );
    expect(phones).toEqual({});
  });

  it("drops a key claimed by two contacts with different phones (ambiguous)", () => {
    const phones = matchPhones(
      [voter("V1", "Ann", "Hara", "63011")],
      [
        { name: "Ann Hara", zip: "63011", phone: "111" },
        { name: "Ann Hara", zip: "63011", phone: "222" },
      ],
    );
    expect(phones).toEqual({});
  });

  it("keeps a key confirmed by the same phone twice (volunteer who also donated)", () => {
    const phones = matchPhones(
      [voter("V1", "Ann", "Hara", "63011")],
      [
        { name: "Ann Hara", zip: "63011", phone: "111" },
        { name: "Ann Hara", zip: "63011", phone: "111" },
      ],
    );
    expect(phones).toEqual({ V1: "111" });
  });
});
