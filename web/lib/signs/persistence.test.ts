import { describe, it, expect } from "vitest";
import { dedupeKey, filterNew, rawToRecord, sanitizePlacement } from "./persistence";
import type { PlacementInput } from "./placement";

const row = (over: Partial<PlacementInput> = {}): PlacementInput => ({
  name: "Daniel Boone Library",
  lat: 38.60313,
  lng: -90.56731,
  type: "site",
  inDistrict: true,
  bufferVerified: false,
  propertyPermission: false,
  ...over,
});

describe("dedupeKey", () => {
  it("normalizes case/whitespace and rounds coordinates to ~1 m", () => {
    expect(dedupeKey(row({ name: "  DANIEL boone library " }))).toBe(dedupeKey(row()));
    expect(dedupeKey(row({ lat: 38.603131, lng: -90.567309 }))).toBe(dedupeKey(row()));
  });

  it("distinguishes same-named locations at different spots, and falls back to name-only without coords", () => {
    expect(dedupeKey(row({ lat: 38.7 }))).not.toBe(dedupeKey(row()));
    expect(dedupeKey({ name: "Main St corridor" })).toBe("main st corridor||");
  });
});

describe("filterNew", () => {
  it("skips rows already saved and self-duplicates within a paste", () => {
    const saved = [row()];
    const out = filterNew(saved, [
      row(), // already saved → skipped
      row({ name: "New Corner", lat: 38.7, lng: -90.4 }),
      row({ name: "new corner", lat: 38.7, lng: -90.4 }), // dupe within the paste → skipped
    ]);
    expect(out.map((r) => r.name)).toEqual(["New Corner"]);
  });

  it("passes everything through when nothing is saved", () => {
    expect(filterNew([], [row()])).toHaveLength(1);
  });
});

describe("sanitizePlacement", () => {
  it("rejects garbage and nameless rows", () => {
    expect(sanitizePlacement(null)).toBeNull();
    expect(sanitizePlacement("x")).toBeNull();
    expect(sanitizePlacement({ lat: 1 })).toBeNull();
    expect(sanitizePlacement({ name: "   " })).toBeNull();
  });

  it("only a literal true flips a compliance gate (truthy strings never do)", () => {
    const p = sanitizePlacement({ name: "x", inDistrict: "true", bufferVerified: 1, propertyPermission: true })!;
    expect(p.inDistrict).toBe(false);
    expect(p.bufferVerified).toBe(false);
    expect(p.propertyPermission).toBe(true);
  });

  it("coerces unknown types to corridor, drops non-finite numbers, clips long text", () => {
    const p = sanitizePlacement({ name: "n".repeat(500), type: "billboard", lat: "38.6", aadtRaw: Infinity, notes: "y".repeat(900) })!;
    expect(p.type).toBe("corridor");
    expect(p.lat).toBeUndefined();
    expect(p.aadtRaw).toBeUndefined();
    expect(p.name).toHaveLength(160);
    expect(p.notes).toHaveLength(500);
  });
});

describe("rawToRecord", () => {
  it("maps a stored item (SK → id) and re-sanitizes the payload", () => {
    const rec = rawToRecord({
      PK: "SIGNPLACEMENT",
      SK: "abc-123",
      name: "Daniel Boone Library",
      type: "site",
      inDistrict: true,
      bufferVerified: "yes", // legacy/hand-edited item — must NOT count as verified
      propertyPermission: true,
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-10T01:00:00Z",
      updatedBy: "staff@example.com",
    })!;
    expect(rec.id).toBe("abc-123");
    expect(rec.bufferVerified).toBe(false);
    expect(rec.propertyPermission).toBe(true);
    expect(rec.updatedBy).toBe("staff@example.com");
  });

  it("returns null for items without a usable id or name", () => {
    expect(rawToRecord({ name: "x" })).toBeNull();
    expect(rawToRecord({ SK: "abc" })).toBeNull();
  });
});
