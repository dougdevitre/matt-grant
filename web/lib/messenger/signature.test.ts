import { describe, it, expect } from "vitest";
import { expectedMetaSignature, verifyMetaSignature, verifyChallengeToken } from "./signature";

const SECRET = "app-secret-123";
const BODY = JSON.stringify({ object: "page", entry: [] });

describe("verifyMetaSignature", () => {
  it("accepts a correctly signed body", () => {
    const sig = expectedMetaSignature(SECRET, BODY);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifyMetaSignature(SECRET, BODY, sig)).toBe(true);
  });

  it("rejects a tampered body, wrong secret, missing/again-malformed header", () => {
    const sig = expectedMetaSignature(SECRET, BODY);
    expect(verifyMetaSignature(SECRET, BODY + " ", sig)).toBe(false); // body changed
    expect(verifyMetaSignature("other-secret", BODY, sig)).toBe(false); // wrong secret
    expect(verifyMetaSignature(SECRET, BODY, null)).toBe(false); // no header
    expect(verifyMetaSignature(SECRET, BODY, "deadbeef")).toBe(false); // no sha256= prefix
    expect(verifyMetaSignature(undefined, BODY, sig)).toBe(false); // secret not configured
  });
});

describe("verifyChallengeToken", () => {
  it("matches only the exact configured token", () => {
    expect(verifyChallengeToken("verify-abc", "verify-abc")).toBe(true);
    expect(verifyChallengeToken("verify-abc", "verify-xyz")).toBe(false);
    expect(verifyChallengeToken(undefined, "verify-abc")).toBe(false);
    expect(verifyChallengeToken("verify-abc", null)).toBe(false);
  });
});
