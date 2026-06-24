import { describe, it, expect } from "vitest";
import { localCentralToIso, isoToCentralLocal } from "./time";

describe("localCentralToIso", () => {
  it("interprets a summer wall-clock as CDT (UTC-5)", () => {
    // 6:00 PM Central on Jul 12 2026 = 23:00 UTC.
    expect(localCentralToIso("2026-07-12T18:00")).toBe("2026-07-12T23:00:00.000Z");
  });

  it("interprets a winter wall-clock as CST (UTC-6)", () => {
    // 6:00 PM Central on Jan 12 2026 = 00:00 UTC next day.
    expect(localCentralToIso("2026-01-12T18:00")).toBe("2026-01-13T00:00:00.000Z");
  });

  it("returns '' for malformed input", () => {
    expect(localCentralToIso("nope")).toBe("");
    expect(localCentralToIso("")).toBe("");
  });
});

describe("isoToCentralLocal", () => {
  it("round-trips with localCentralToIso (summer + winter)", () => {
    for (const local of ["2026-07-12T18:00", "2026-01-12T18:00", "2026-08-04T07:30"]) {
      expect(isoToCentralLocal(localCentralToIso(local))).toBe(local);
    }
  });

  it("returns '' for an invalid ISO string", () => {
    expect(isoToCentralLocal("garbage")).toBe("");
  });
});
