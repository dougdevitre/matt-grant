import { describe, it, expect } from "vitest";
import { signFeature, signVerified } from "./geo";
import type { SignPlacementRecord } from "./persistence";

const rec = (over: Partial<SignPlacementRecord> = {}): SignPlacementRecord & { lat: number; lng: number } => ({
  id: "abc",
  name: "Daniel Boone Library",
  lat: 38.6031,
  lng: -90.5673,
  type: "site",
  inDistrict: true,
  bufferVerified: true,
  propertyPermission: true,
  createdAt: "",
  updatedAt: "",
  updatedBy: "",
  ...over,
}) as SignPlacementRecord & { lat: number; lng: number };

describe("signVerified", () => {
  it("requires ALL three gates (hardFilter's deployability definition)", () => {
    expect(signVerified(rec())).toBe(true);
    expect(signVerified(rec({ inDistrict: false }))).toBe(false);
    expect(signVerified(rec({ bufferVerified: false }))).toBe(false);
    expect(signVerified(rec({ propertyPermission: false }))).toBe(false);
  });
});

describe("signFeature", () => {
  it("builds a Point feature with [lng, lat] order and the map's property shape", () => {
    const f = signFeature(rec({ captainId: "cap@x.com", notes: "corner lot" }));
    expect(f.geometry).toEqual({ type: "Point", coordinates: [-90.5673, 38.6031] });
    expect(f.properties).toEqual({
      id: "abc",
      name: "Daniel Boone Library",
      type: "site",
      verified: true,
      captainId: "cap@x.com",
      notes: "corner lot",
    });
  });

  it("blanks optional fields rather than emitting undefined", () => {
    const f = signFeature(rec({ bufferVerified: false }));
    expect(f.properties).toMatchObject({ verified: false, captainId: "", notes: "" });
  });
});
