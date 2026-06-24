import { describe, it, expect } from "vitest";
import { parseCensusGeocode, oneLineAddress } from "./geocode";

describe("parseCensusGeocode", () => {
  const match = (x: number, y: number) => ({ result: { addressMatches: [{ coordinates: { x, y } }] } });

  it("pulls lat/lng from the first match (Census uses x=lng, y=lat)", () => {
    expect(parseCensusGeocode(match(-90.4, 38.58))).toEqual({ lat: 38.58, lng: -90.4 });
  });

  it("returns null when there are no matches", () => {
    expect(parseCensusGeocode({ result: { addressMatches: [] } })).toBeNull();
    expect(parseCensusGeocode({})).toBeNull();
    expect(parseCensusGeocode(null)).toBeNull();
  });

  it("rejects a 0,0 / non-numeric coordinate", () => {
    expect(parseCensusGeocode(match(0, 0))).toBeNull();
    expect(parseCensusGeocode({ result: { addressMatches: [{ coordinates: { x: "n/a", y: "n/a" } }] } })).toBeNull();
  });
});

describe("oneLineAddress", () => {
  it("requires a street line (a bare city won't geocode to a point)", () => {
    expect(oneLineAddress({ city: "Chesterfield" })).toBeNull();
    expect(oneLineAddress({ address: "" })).toBeNull();
  });

  it("assembles street + city + MO", () => {
    expect(oneLineAddress({ address: "1 Main St", city: "Hillsboro" })).toBe("1 Main St, Hillsboro, MO");
    expect(oneLineAddress({ address: "1 Main St" })).toBe("1 Main St, MO");
  });
});
