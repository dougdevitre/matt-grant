import { describe, it, expect } from "vitest";
import { decideCanSend } from "@/lib/sms/conversations";
import { PK } from "@/lib/db";

describe("decideCanSend (1:1 send gate)", () => {
  it("blocks a blocked number above everything else", () => {
    const d = decideCanSend({ blocked: true, consentStatus: "opted_in", hasInbound: true });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/blocked/i);
  });

  it("refuses an opted-out number", () => {
    expect(decideCanSend({ blocked: false, consentStatus: "opted_out", hasInbound: true }).allowed).toBe(false);
  });

  it("allows an opted-in number, flagging cold initiation as first contact", () => {
    expect(decideCanSend({ blocked: false, consentStatus: "opted_in", hasInbound: false })).toMatchObject({
      allowed: true,
      firstContact: true,
    });
    expect(decideCanSend({ blocked: false, consentStatus: "opted_in", hasInbound: true })).toMatchObject({
      allowed: true,
      firstContact: false,
    });
  });

  it("allows replying to an unknown number that texted us first", () => {
    expect(decideCanSend({ blocked: false, consentStatus: "unknown", hasInbound: true }).allowed).toBe(true);
  });

  it("refuses an unknown number that never texted us", () => {
    expect(decideCanSend({ blocked: false, consentStatus: "unknown", hasInbound: false }).allowed).toBe(false);
  });
});

describe("conversation key builders", () => {
  it("threads are partitioned per E.164", () => {
    expect(PK.smsThread("+13145551234")).toBe("SMSTHREAD#+13145551234");
    expect(PK.smsConvos).toBe("SMSCONVO");
    expect(PK.smsBlocks).toBe("SMSBLOCK");
  });
});
