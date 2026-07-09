import { describe, it, expect } from "vitest";
import { REPLY_LINKS, replyInsert, replyLinkUrl, suggestReplyLinks } from "@/lib/sms/reply-links";
import { nonGsmChars } from "@/lib/sms/templates";
import { ISSUES } from "@/lib/issues";
import { SITE_URL, CAMPAIGN } from "@/lib/site";

describe("reply-links registry", () => {
  it("builds UTM-tagged absolute URLs and GSM-7-clean inserts for every entry", () => {
    for (const l of REPLY_LINKS) {
      const url = replyLinkUrl(l);
      expect(url, l.label).toMatch(/^https?:\/\//); // absolute
      expect(url).toContain(`utm_campaign=${l.campaign}`);
      // The full insert (lead + link) must stay GSM-7 so it doesn't force pricier UCS-2.
      expect(nonGsmChars(replyInsert(l)), l.label).toEqual([]);
    }
  });

  it("keeps the four priorities in sync with the canonical ISSUES slugs", () => {
    const priorityDests = REPLY_LINKS.filter((l) => l.dest.startsWith("/issues/")).map((l) => l.dest);
    for (const i of ISSUES) expect(priorityDests).toContain(`/issues/${i.slug}`);
  });

  it("donate points at the external WinRed URL; site links absolutize against SITE_URL", () => {
    expect(replyLinkUrl(REPLY_LINKS.find((l) => l.label === "Donate")!)).toContain(CAMPAIGN.donateUrl.split("?")[0]);
    expect(replyLinkUrl(REPLY_LINKS.find((l) => l.label === "How to vote")!)).toContain(`${SITE_URL}/vote`);
  });
});

describe("suggestReplyLinks", () => {
  it("surfaces the family-courts link when someone raises corruption", () => {
    const s = suggestReplyLinks("I'm concerned about corruption");
    expect(s[0]?.dest).toBe("/issues/family-courts");
  });

  it("matches vote + absentee for a mail-voting question", () => {
    const dests = suggestReplyLinks("how do I vote absentee by mail?").map((l) => l.dest);
    expect(dests).toEqual(expect.arrayContaining(["/vote", "/vote/absentee"]));
  });

  it("is case-insensitive and returns nothing for empty / off-topic input", () => {
    expect(suggestReplyLinks("DONATE please").some((l) => l.label === "Donate")).toBe(true);
    expect(suggestReplyLinks("")).toEqual([]);
    expect(suggestReplyLinks("xyzzy blorp")).toEqual([]);
  });
});
