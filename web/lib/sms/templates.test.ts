import { describe, it, expect } from "vitest";
import { smsSegments, withCompliance, getSmsTemplate, SMS_COMPLIANCE_SUFFIX, SMS_TEMPLATES, nonGsmChars, daysUntilElection, donationThankYouSms } from "./templates";
import { CAMPAIGN } from "@/lib/site";

describe("smsSegments", () => {
  it("counts GSM-7 single + multi segment boundaries", () => {
    expect(smsSegments("")).toEqual({ chars: 0, segments: 0, encoding: "GSM-7" });
    expect(smsSegments("a".repeat(160))).toMatchObject({ segments: 1, encoding: "GSM-7" });
    expect(smsSegments("a".repeat(161))).toMatchObject({ segments: 2, encoding: "GSM-7" });
  });

  it("treats extended GSM chars as 2 septets", () => {
    expect(smsSegments("€").chars).toBe(2); // € is in the GSM extension table
  });

  it("switches to UCS-2 on non-GSM characters with a 70-char single segment", () => {
    expect(smsSegments("😀")).toMatchObject({ encoding: "UCS-2", segments: 1 });
    expect(smsSegments("é".repeat(70))).toMatchObject({ encoding: "GSM-7" }); // é is GSM-7 basic
    expect(smsSegments("😀".repeat(36))).toMatchObject({ encoding: "UCS-2", segments: 2 }); // 72 UTF-16 units > 70
  });
});

describe("withCompliance", () => {
  it("appends sender id + STOP to a non-empty body, no-ops on empty", () => {
    expect(withCompliance("Vote Aug 4")).toBe(`Vote Aug 4${SMS_COMPLIANCE_SUFFIX}`);
    expect(withCompliance("   ")).toBe("");
    expect(SMS_COMPLIANCE_SUFFIX).toContain("Reply STOP to opt out"); // TCPA opt-out
    expect(SMS_COMPLIANCE_SUFFIX).toContain(CAMPAIGN.paidForBy); // FEC disclaimer
  });
});

describe("GSM-7 cost guard", () => {
  // A single non-GSM char (em dash, smart quote, emoji) forces the WHOLE message to UCS-2,
  // halving the per-segment size (70 vs 160) and ~2x-ing cost. The compliance suffix rides on
  // every text, so it must stay GSM-7 — regression-lock it and the built-in templates.
  it("the compliance suffix is GSM-7 clean (no em dash / smart quotes)", () => {
    expect(nonGsmChars(SMS_COMPLIANCE_SUFFIX)).toEqual([]);
    expect(smsSegments(SMS_COMPLIANCE_SUFFIX).encoding).toBe("GSM-7");
  });

  it("a typical disclaimered blast stays GSM-7 (single segment, not UCS-2)", () => {
    const body = withCompliance("Reminder: town hall Sat 10am at Chesterfield. Hope to see you there!");
    expect(smsSegments(body)).toMatchObject({ encoding: "GSM-7", segments: 1 });
  });

  it("every built-in template renders GSM-7-clean copy", () => {
    const sample = {
      what: "Town hall", when: "Sat 10am", where: "Chesterfield", days: "3",
      message: "Doors at 6pm", activity: "Canvass", body: "Hello team",
      priority: "family courts", note: "Big news:", focus: "Weekend push", ask: "Confirm shifts",
    };
    for (const t of SMS_TEMPLATES) {
      expect(nonGsmChars(withCompliance(t.build(sample))), t.key).toEqual([]);
    }
  });

  it("nonGsmChars names the offending characters (and is empty when clean)", () => {
    expect(nonGsmChars("Plain ascii text.")).toEqual([]);
    expect(nonGsmChars("Smart ’quote’ and —dash")).toEqual(expect.arrayContaining(["’", "—"]));
  });
});

describe("templates", () => {
  it("custom template echoes the body; gotv mentions the primary", () => {
    expect(getSmsTemplate("custom")!.build({ body: "hello" })).toBe("hello");
    expect(getSmsTemplate("gotv")!.build({ days: "3" })).toContain("3 days away");
    expect(getSmsTemplate("nope")).toBeUndefined();
  });

  it("internal team templates build logistics copy", () => {
    expect(getSmsTemplate("team-update")!.build({ message: "Meeting 6pm" })).toBe("Team: Meeting 6pm");
    expect(getSmsTemplate("shift-reminder")!.build({ activity: "Canvass", when: "Sat 9am", where: "HQ" })).toBe(
      "Canvass reminder: Sat 9am at HQ. Thanks for showing up!",
    );
    expect(getSmsTemplate("captain-brief")!.build({ focus: "Weekend push", ask: "Confirm shifts" })).toBe(
      "Captains - Weekend push. Confirm shifts",
    );
  });

  it("gotv auto-fills the countdown from the election date when days is blank", () => {
    // 10 days before the primary → "10 days away"; explicit value still wins.
    const tenDaysBefore = new Date(new Date(CAMPAIGN.electionDate).getTime() - 10 * 86_400_000);
    expect(daysUntilElection(tenDaysBefore)).toBe(10);
    expect(getSmsTemplate("gotv")!.build({})).toMatch(/(days away|tomorrow|today|almost here)/);
    expect(getSmsTemplate("gotv")!.build({ days: "5" })).toContain("5 days away");
  });

  it("issue-update deep-links a matched priority, or falls back to /issues", () => {
    const matched = getSmsTemplate("issue-update")!.build({ priority: "family courts" });
    expect(matched).toContain("/issues/family-courts");
    expect(matched).toContain("utm_campaign=issue-family-courts");
    expect(getSmsTemplate("issue-update")!.build({ priority: "taxes" })).toContain("/issues/lower-taxes");
    expect(getSmsTemplate("issue-update")!.build({ priority: "" })).toContain("/issues");
  });

  it("donationThankYouSms is GSM-7 clean, merges name/amount, and stays 1 segment with the suffix", () => {
    // Plain (no name/amount)
    const plain = donationThankYouSms();
    expect(plain).toContain("Matt Grant for Congress");
    expect(nonGsmChars(withCompliance(plain))).toEqual([]);
    // With a name + amount — still GSM-7 and a single segment after the compliance suffix
    const full = donationThankYouSms("Jordan", 250);
    expect(full).toContain("Jordan");
    expect(full).toContain("$250");
    expect(nonGsmChars(withCompliance(full))).toEqual([]);
    expect(smsSegments(withCompliance(full)).segments).toBe(1);
    // A long name + max primary gift still fits one segment (guards the copy length)
    expect(smsSegments(withCompliance(donationThankYouSms("Jonathan", 3300))).segments).toBe(1);
    // A zero/absent amount omits the "$" clause
    expect(donationThankYouSms("Sam", 0)).not.toContain("$");
    // A non-GSM donor name is DROPPED so it can't tip the text to pricey UCS-2.
    const francois = donationThankYouSms("François", 50); // ç is not GSM-7 basic
    expect(francois).not.toContain("François");
    expect(nonGsmChars(withCompliance(francois))).toEqual([]);
    expect(smsSegments(withCompliance(francois)).encoding).toBe("GSM-7");
  });
});

describe("every template stays one GSM-7 segment (the cost guard)", () => {
  // A second segment doubles the cost of an ENTIRE blast, and one curly quote or
  // em dash flips the encoding to UCS-2 (160 chars/segment -> 70), which does the
  // same. These are the two ways a copy edit silently doubles the bill, so lock
  // both down for every template as the composer would actually render it.
  const rendered = (t: (typeof SMS_TEMPLATES)[number], over: Record<string, string> = {}) => {
    const v: Record<string, string> = {};
    for (const f of t.fields) v[f.name] = over[f.name] ?? f.placeholder ?? "";
    return withCompliance(t.build(v));
  };

  // issue-update carries a full UTM-tagged campaign URL, which alone is ~120
  // characters — it cannot fit one segment without a short link (which
  // messaging/sms-texting.md §3 already tells operators to use). Exempted
  // deliberately and bounded below, not quietly excluded.
  const MULTI_SEGMENT_OK = new Set(["issue-update"]);

  for (const t of SMS_TEMPLATES) {
    if (t.key === "custom") continue; // operator-authored; the composer warns live
    it(`${t.key} is GSM-7${MULTI_SEGMENT_OK.has(t.key) ? "" : " and one segment"}`, () => {
      const body = rendered(t);
      expect(nonGsmChars(body), `non-GSM characters in "${t.key}"`).toEqual([]);
      if (!MULTI_SEGMENT_OK.has(t.key)) {
        expect(smsSegments(body).segments, `"${t.key}" body: ${body}`).toBe(1);
      }
    });
  }

  it("issue-update stays within two segments even with its tracked URL", () => {
    // Bounded so the copy can't drift to three. Shorten the link to reach one.
    const t = SMS_TEMPLATES.find((x) => x.key === "issue-update")!;
    expect(smsSegments(rendered(t)).segments).toBeLessThanOrEqual(2);
  });

  it("the election-day closing variant also fits one segment", () => {
    const t = SMS_TEMPLATES.find((x) => x.key === "election-day")!;
    const body = rendered(t, { phase: "closing" });
    expect(body).toContain("7pm");
    expect(nonGsmChars(body)).toEqual([]);
    expect(smsSegments(body).segments).toBe(1);
  });

  it("the compliance suffix leaves usable headroom", () => {
    // 160 - suffix = the budget every body above is written against.
    expect(SMS_COMPLIANCE_SUFFIX.length).toBeLessThan(70);
    expect(nonGsmChars(SMS_COMPLIANCE_SUFFIX)).toEqual([]);
  });
});
