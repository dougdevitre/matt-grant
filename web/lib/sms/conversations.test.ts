import { describe, it, expect } from "vitest";
import { decideCanSend, identifyReply } from "@/lib/sms/conversations";
import { nonGsmChars } from "@/lib/sms/templates";
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

describe("identifyReply (first-outbound sender ID)", () => {
  it("prepends the committee name so it isn't an unknown sender", () => {
    expect(identifyReply("How can I help?")).toBe("Matt Grant for Congress: How can I help? Reply STOP to opt out.");
  });

  it("adds a one-time STOP notice, but doesn't duplicate one already present", () => {
    expect(identifyReply("Hi. Reply STOP to opt out.")).toBe("Matt Grant for Congress: Hi. Reply STOP to opt out.");
    expect((identifyReply("Hi there").match(/reply stop/gi) ?? []).length).toBe(1);
  });

  it("stays GSM-7 clean (no pricier UCS-2)", () => {
    expect(nonGsmChars(identifyReply("Thanks for reaching out!"))).toEqual([]);
  });
});

describe("conversation key builders", () => {
  it("threads are partitioned per E.164", () => {
    expect(PK.smsThread("+13145551234")).toBe("SMSTHREAD#+13145551234");
    expect(PK.smsConvos).toBe("SMSCONVO");
    expect(PK.smsBlocks).toBe("SMSBLOCK");
  });
});
