import { describe, it, expect } from "vitest";
import { ctaLink, resolveCta, welcomeReply, CTA_KEYWORDS } from "@/lib/sms/ctas";
import { CAMPAIGN, SITE_URL } from "@/lib/site";

describe("ctaLink", () => {
  it("absolutizes a site path and adds UTM attribution by keyword", () => {
    const l = ctaLink("/join", "VOLUNTEER");
    expect(l).toBe(`${SITE_URL}/join?utm_source=sms&utm_medium=text&utm_campaign=volunteer`);
  });
  it("uses & when the destination URL already has a query string (WinRed donate)", () => {
    const l = ctaLink(CAMPAIGN.donateUrl, "DONATE");
    expect(l.startsWith(CAMPAIGN.donateUrl + "&utm_source=sms")).toBe(true);
    expect(l).not.toContain("?utm_source"); // must not add a second '?'
  });
  it("passes external URLs through instead of prefixing the site origin", () => {
    expect(ctaLink("https://x.example/p", "VOTE")).toContain("https://x.example/p?utm_source=sms");
  });
});

describe("resolveCta", () => {
  it("resolves each advertised keyword to a compliant reply", () => {
    for (const kw of CTA_KEYWORDS) {
      const cta = resolveCta(kw);
      expect(cta, kw).not.toBeNull();
      // Compliant by construction: FEC disclaimer + STOP on every CTA reply.
      expect(cta!.reply).toContain(CAMPAIGN.paidForBy);
      expect(cta!.reply).toMatch(/Reply STOP to opt out/i);
      expect(cta!.reply).toContain("utm_campaign=" + kw.toLowerCase());
      expect(cta!.source).toMatch(/^sms-cta-/);
    }
  });
  it("matches aliases and is case/punctuation-insensitive", () => {
    expect(resolveCta("give")!.source).toBe("sms-cta-donate");
    expect(resolveCta("chip-in")!.source).toBe("sms-cta-donate");
    expect(resolveCta("RSVP")!.source).toBe("sms-cta-events");
    expect(resolveCta("vol")!.source).toBe("sms-cta-volunteer");
    // Early-vote window aliases route to the vote agent's CTA.
    expect(resolveCta("EARLY")!.source).toBe("sms-cta-vote");
    expect(resolveCta("early vote")!.source).toBe("sms-cta-vote");
  });
  it("points DONATE at the WinRed URL and VOTE at /vote", () => {
    expect(resolveCta("DONATE")!.reply).toContain(CAMPAIGN.donateUrl);
    expect(resolveCta("VOTE")!.reply).toContain(`${SITE_URL}/vote?`);
  });
  it("returns null for reserved words and unknown keywords", () => {
    // The route handles these before ever calling resolveCta; guard anyway.
    for (const kw of ["STOP", "START", "HELP", "MATT", "", "gibberish"]) {
      expect(resolveCta(kw), kw).toBeNull();
    }
  });
});

describe("welcomeReply", () => {
  it("drives to the campaign platform (/sign-up) with a CTA + disclaimer + opt-out", () => {
    const r = welcomeReply();
    expect(r).toContain(`${SITE_URL}/sign-up?`);
    expect(r).toContain("utm_campaign=welcome");
    expect(r).toMatch(/Join the campaign platform/i);
    expect(r).toMatch(/Save us as Matt Grant for Congress/i); // cut the "unknown sender" spam flag
    expect(r).toContain(CAMPAIGN.paidForBy);
    expect(r).toMatch(/Reply STOP to opt out/i);
    expect(r).toMatch(/HELP for help/i);
  });
});
