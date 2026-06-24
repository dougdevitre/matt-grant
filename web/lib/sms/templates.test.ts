import { describe, it, expect } from "vitest";
import { smsSegments, withCompliance, getSmsTemplate, SMS_COMPLIANCE_SUFFIX } from "./templates";

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
    expect(SMS_COMPLIANCE_SUFFIX).toContain("Reply STOP to opt out");
  });
});

describe("templates", () => {
  it("custom template echoes the body; gotv mentions the primary", () => {
    expect(getSmsTemplate("custom")!.build({ body: "hello" })).toBe("hello");
    expect(getSmsTemplate("gotv")!.build({ days: "3" })).toContain("3 days away");
    expect(getSmsTemplate("nope")).toBeUndefined();
  });
});
