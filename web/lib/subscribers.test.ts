import { describe, it, expect } from "vitest";
import { unsubToken, verifyUnsubToken, unsubscribeUrl } from "@/lib/subscribers";

describe("unsubscribe token", () => {
  it("round-trips and normalizes the email", async () => {
    const t = await unsubToken("Jane@Example.com");
    expect(await verifyUnsubToken(t)).toBe("jane@example.com");
  });

  it("rejects tampered or junk tokens", async () => {
    const t = await unsubToken("a@b.co");
    expect(await verifyUnsubToken(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(await verifyUnsubToken("garbage")).toBeNull();
    expect(await verifyUnsubToken("")).toBeNull();
    expect(await verifyUnsubToken("only-one-part")).toBeNull();
  });

  it("rejects a forged token whose email was swapped under a valid signature", async () => {
    const sig = (await unsubToken("a@b.co")).split(".")[1];
    const forged = `${Buffer.from("evil@x.co").toString("base64url")}.${sig}`;
    expect(await verifyUnsubToken(forged)).toBeNull();
  });

  it("builds an absolute URL and de-dupes the trailing slash", async () => {
    expect(await unsubscribeUrl("https://x.org/", "a@b.co")).toMatch(/^https:\/\/x\.org\/unsubscribe\?token=/);
    expect(await unsubscribeUrl("https://x.org", "a@b.co")).toMatch(/^https:\/\/x\.org\/unsubscribe\?token=/);
  });
});
