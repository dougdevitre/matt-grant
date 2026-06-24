import { describe, it, expect } from "vitest";
import { secretMatches } from "./webhookAuth";

describe("secretMatches", () => {
  it("accepts an exact match", () => {
    expect(secretMatches("s3cret-token", "s3cret-token")).toBe(true);
  });
  it("rejects a different value of the same length", () => {
    expect(secretMatches("aaaaaa", "bbbbbb")).toBe(false);
  });
  it("rejects a length mismatch (no timingSafeEqual throw)", () => {
    expect(secretMatches("short", "longer-secret")).toBe(false);
  });
  it("rejects empty/absent provided or secret", () => {
    expect(secretMatches("", "secret")).toBe(false);
    expect(secretMatches("secret", "")).toBe(false);
    expect(secretMatches(null, "secret")).toBe(false);
    expect(secretMatches("secret", undefined)).toBe(false);
  });
});
