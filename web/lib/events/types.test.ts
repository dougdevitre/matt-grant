import { describe, it, expect } from "vitest";
import { spotsLeft, isEventFull } from "./types";

describe("spotsLeft", () => {
  it("returns null for unlimited (null) capacity", () => {
    expect(spotsLeft(null, 50)).toBeNull();
  });
  it("returns the remaining count", () => {
    expect(spotsLeft(10, 3)).toBe(7);
  });
  it("never goes negative", () => {
    expect(spotsLeft(10, 12)).toBe(0);
  });
});

describe("isEventFull", () => {
  it("is never full when capacity is unlimited", () => {
    expect(isEventFull(null, 9999)).toBe(false);
  });
  it("is full at and beyond capacity", () => {
    expect(isEventFull(10, 10)).toBe(true);
    expect(isEventFull(10, 11)).toBe(true);
  });
  it("is not full below capacity", () => {
    expect(isEventFull(10, 9)).toBe(false);
  });
});
