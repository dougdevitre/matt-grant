import { describe, it, expect } from "vitest";
import {
  askGeoReply,
  awaitingGeoActive,
  countyVoteReply,
  earlyVotePhrase,
  parseGeoAnswer,
  unknownGeoReply,
  EARLY_VOTE_OPENS,
  EARLY_VOTE_ENDS,
  MAIL_APP_DEADLINE,
  GEO_AWAIT_TTL_MS,
} from "@/lib/sms/votebot";
import { COUNTIES, ZIP_TO_COUNTY, countyByKey, matchCountyName, matchZip } from "@/lib/sms/geo";
import { nonGsmChars } from "@/lib/sms/templates";
import { CAMPAIGN } from "@/lib/site";

const DURING = new Date("2026-07-25T12:00:00-05:00"); // inside the early-vote window
const BEFORE = new Date("2026-07-20T12:00:00-05:00"); // the day before it opens
const AFTER = new Date("2026-08-04T08:00:00-05:00"); // Election Day morning

describe("geo matching", () => {
  it("matches every MO-02 county by name, case/punctuation-insensitive", () => {
    expect(matchCountyName("St. Louis")!.key).toBe("st-louis");
    expect(matchCountyName("saint louis county")!.key).toBe("st-louis");
    expect(matchCountyName("STL")!.key).toBe("st-louis");
    expect(matchCountyName("Franklin")!.key).toBe("franklin");
    expect(matchCountyName("jefferson county")!.key).toBe("jefferson");
    expect(matchCountyName("JeffCo")!.key).toBe("jefferson");
    expect(matchCountyName("Washington")!.key).toBe("washington");
    expect(matchCountyName("crawford")!.key).toBe("crawford");
    expect(matchCountyName("Gasconade")!.key).toBe("gasconade");
  });

  it("rejects non-MO-02 counties and noise", () => {
    for (const s of ["St. Charles", "STLX", "", "gibberish", "63011th street"]) {
      expect(matchCountyName(s), s).toBeNull();
    }
  });

  it("matches only verified starter-map ZIPs, anywhere in the message", () => {
    expect(matchZip("63084")!.county.key).toBe("franklin");
    expect(matchZip("I live in 63011 now")!.county.key).toBe("st-louis");
    expect(matchZip("99999")).toBeNull(); // not an MO-02 verified ZIP
    expect(matchZip("630110")).toBeNull(); // 6 digits is not a ZIP
    expect(matchZip("no digits here")).toBeNull();
  });

  it("every starter-map ZIP resolves to a real county", () => {
    for (const key of Object.values(ZIP_TO_COUNTY)) expect(COUNTIES[key]).toBeDefined();
  });

  it("countyByKey resolves stored keys and rejects junk", () => {
    expect(countyByKey("franklin")!.name).toBe("Franklin County");
    expect(countyByKey("nope")).toBeNull();
    expect(countyByKey(undefined)).toBeNull();
  });
});

describe("parseGeoAnswer", () => {
  it("prefers a verified ZIP (exact data) over a county name in the same text", () => {
    // "Union MO 63084" — the ZIP pins Franklin even without the county word.
    expect(parseGeoAnswer("Union MO 63084")).toEqual({ county: "franklin", zip: "63084" });
  });
  it("falls back to the county name when the ZIP isn't in the starter map", () => {
    expect(parseGeoAnswer("Jefferson county, 99999")).toEqual({ county: "jefferson" });
  });
  it("returns null when nothing matches (caller sends the fallback)", () => {
    expect(parseGeoAnswer("I have a question about yard signs")).toBeNull();
  });
});

describe("earlyVotePhrase", () => {
  it("tracks the calendar: before / during / after the no-excuse window", () => {
    expect(earlyVotePhrase(BEFORE)).toContain("starts Tue July 21");
    expect(earlyVotePhrase(DURING)).toContain("open now");
    expect(earlyVotePhrase(AFTER)).toContain("Election Day");
    // Boundary sanity: the window's own timestamps count as open.
    expect(earlyVotePhrase(new Date(EARLY_VOTE_OPENS))).toContain("open now");
    expect(earlyVotePhrase(new Date(EARLY_VOTE_ENDS))).toContain("open now");
  });
});

describe("vote agent replies", () => {
  it("every reply is compliant by construction (FEC disclaimer + STOP) and GSM-7 clean", () => {
    const replies = [askGeoReply(), unknownGeoReply(), ...Object.values(COUNTIES).map((c) => countyVoteReply(c, DURING))];
    for (const r of replies) {
      expect(r).toContain(CAMPAIGN.paidForBy);
      expect(r).toMatch(/Reply STOP to opt out/i);
      expect(nonGsmChars(r), r).toEqual([]); // one stray smart quote would ~2x segment cost
    }
  });

  it("the ask names all six counties and offers the ZIP option", () => {
    const ask = askGeoReply();
    for (const c of ["ST LOUIS", "FRANKLIN", "JEFFERSON", "WASHINGTON", "CRAWFORD", "GASCONADE"]) {
      expect(ask).toContain(c);
    }
    expect(ask).toMatch(/5-digit ZIP/);
  });

  it("a county reply carries the authority, office, phone, and the tracked guide link", () => {
    const r = countyVoteReply(COUNTIES.franklin, DURING);
    expect(r).toContain("Franklin County");
    expect(r).toContain("Franklin County Clerk");
    expect(r).toContain("Union");
    expect(r).toContain("636.583.6355");
    expect(r).toContain("/vote/absentee?utm_source=sms");
    expect(r).toContain("photo ID");
  });

  it("mentions the mail-application deadline only while it is still live", () => {
    const before = countyVoteReply(COUNTIES["st-louis"], new Date("2026-07-21T09:00:00-05:00"));
    expect(before).toContain("5pm Wed July 22");
    const atDeadline = countyVoteReply(COUNTIES["st-louis"], new Date(MAIL_APP_DEADLINE));
    expect(atDeadline).toContain("5pm Wed July 22"); // inclusive of the deadline moment
    const after = countyVoteReply(COUNTIES["st-louis"], new Date("2026-07-23T09:00:00-05:00"));
    expect(after).not.toContain("July 22");
  });
});

describe("awaitingGeoActive", () => {
  const now = DURING;
  it("is live only for a fresh, un-expired geo question", () => {
    const fresh = { awaiting: "geo", awaitingAt: new Date(now.getTime() - 60_000).toISOString() };
    expect(awaitingGeoActive(fresh, now)).toBe(true);
    const stale = { awaiting: "geo", awaitingAt: new Date(now.getTime() - GEO_AWAIT_TTL_MS - 1).toISOString() };
    expect(awaitingGeoActive(stale, now)).toBe(false);
  });
  it("is inert without the flag, a timestamp, or a conversation at all", () => {
    expect(awaitingGeoActive(null, now)).toBe(false);
    expect(awaitingGeoActive({}, now)).toBe(false);
    expect(awaitingGeoActive({ awaiting: "geo" }, now)).toBe(false); // no awaitingAt
    expect(awaitingGeoActive({ awaiting: "geo", awaitingAt: "not-a-date" }, now)).toBe(false);
  });
});
