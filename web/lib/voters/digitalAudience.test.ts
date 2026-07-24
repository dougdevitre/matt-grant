import { describe, it, expect } from "vitest";
import { normalizeName, zip5, sha256hex, audienceRow, audienceCsv, AUDIENCE_HEADERS } from "./digitalAudience";
import type { StoredVoter } from "./storeTypes";

// Real SHA-256 vectors (computed with node:crypto) for the normalized values.
const H = {
  obrien: "b4cb6cb33fe4b865868de825023a1e2790dc12ac01ecc8d7c5afe8254071c8ba",
  matt: "4f31fa50e5bd5ff45684e560fc24aeee527a43739ab611c49c51098a33e2b469",
  grant: "3492ad65d05a973fef8c825521eeb41ae64625a672a8aeeeabc696e16d62a020",
  saintlouis: "a27d04822bc9b2196e53f09c0113ee1cf93bc3b536b1df6ae6028e36c7d1df46",
  mo: "f4a4ce5fa6340a35aa5db0b4b6d31a6fbaa6052356460dbb0537657d803f5be2",
  us: "79adb2a2fce5c6ba215fe5f27f532d4e7edbac4b6a5e09e1ef3a08084a904621",
  z63131: "9e2a8ab47158143ed5c3ce36ff64ba3d62ce92b48a7862760d3e8f7e275db661",
};

const voter = (o: Partial<StoredVoter>): StoredVoter => ({
  voterId: "V1", firstName: "Matt", lastName: "Grant", address: "1 Main", city: "Saint Louis",
  zip: "63131", county: "st-louis", precinctName: "P", yob: 1980, active: true, lastVoted: null,
  t: 4, s: 3, segment: "BANK", newRegistrant: false, ...o,
});

describe("normalizeName", () => {
  it("lowercases and strips punctuation/whitespace", () => {
    expect(normalizeName("O'Brien")).toBe("obrien");
    expect(normalizeName("  Saint  Louis ")).toBe("saintlouis");
    expect(normalizeName("MO")).toBe("mo");
    expect(normalizeName(null)).toBe("");
  });
});

describe("zip5", () => {
  it("keeps the first 5 digits", () => {
    expect(zip5("63131-1234")).toBe("63131");
    expect(zip5("63131")).toBe("63131");
    expect(zip5(null)).toBe("");
  });
});

describe("sha256hex", () => {
  it("hashes a value, empty → empty (blank cell, not a hash of '')", () => {
    expect(sha256hex("obrien")).toBe(H.obrien);
    expect(sha256hex("")).toBe("");
  });
});

describe("audienceRow", () => {
  it("hashes each field; state/country default to MO/US", () => {
    const r = audienceRow(voter({ firstName: "Matt", lastName: "Grant", city: "Saint Louis", zip: "63131-9999" }));
    expect(r).toEqual({ fn: H.matt, ln: H.grant, ct: H.saintlouis, st: H.mo, zip: H.z63131, country: H.us });
  });

  it("a missing field hashes to a blank cell", () => {
    const r = audienceRow(voter({ zip: "" }));
    expect(r.zip).toBe("");
    expect(r.fn).toBe(H.matt); // others still present
  });

  it("honors overridden state/country", () => {
    const r = audienceRow(voter({}), { state: "IL", country: "US" });
    expect(r.st).toBe(sha256hex("il"));
    expect(r.country).toBe(H.us);
  });
});

describe("audienceCsv", () => {
  it("emits the Meta header then one hashed row per voter — no PII, no banner", () => {
    const csv = audienceCsv([voter({}), voter({ voterId: "V2", firstName: "Ann" })]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(AUDIENCE_HEADERS.join(","));
    expect(lines).toHaveLength(3); // header + 2 voters
    // Every non-empty cell is a 64-char hex hash; no plaintext name/zip leaks.
    for (const line of lines.slice(1)) {
      for (const cell of line.split(",")) expect(cell).toMatch(/^[0-9a-f]{64}$|^$/);
    }
    expect(csv).not.toContain("Matt");
    expect(csv).not.toContain("63131");
  });
});
