import { describe, it, expect } from "vitest";
import { unsubToken, verifyUnsubToken, unsubscribeUrl } from "@/lib/subscribers";

describe("unsubscribe token", () => {
  it("round-trips and normalizes the email", () => {
    const t = unsubToken("Jane@Example.com");
    expect(verifyUnsubToken(t)).toBe("jane@example.com");
  });

  it("rejects tampered or junk tokens", () => {
    const t = unsubToken("a@b.co");
    expect(verifyUnsubToken(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(verifyUnsubToken("garbage")).toBeNull();
    expect(verifyUnsubToken("")).toBeNull();
    expect(verifyUnsubToken("only-one-part")).toBeNull();
  });

  it("rejects a forged token whose email was swapped under a valid signature", () => {
    const sig = unsubToken("a@b.co").split(".")[1];
    const forged = `${Buffer.from("evil@x.co").toString("base64url")}.${sig}`;
    expect(verifyUnsubToken(forged)).toBeNull();
  });

  it("builds an absolute URL and de-dupes the trailing slash", () => {
    expect(unsubscribeUrl("https://x.org/", "a@b.co")).toMatch(/^https:\/\/x\.org\/unsubscribe\?token=/);
    expect(unsubscribeUrl("https://x.org", "a@b.co")).toMatch(/^https:\/\/x\.org\/unsubscribe\?token=/);
  });
});
