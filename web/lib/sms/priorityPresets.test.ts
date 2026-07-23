import { describe, it, expect } from "vitest";
import {
  SMS_PRIORITY_PRESETS,
  isSmsPriorityPreset,
  presetTokens,
  parseTargetToken,
  VOTER_SEGMENT_NAMES,
  OUTSTANDING_TOKEN,
} from "./audiences";

// The composer's "Who to reach — by likelihood to vote" dropdown is built from
// SMS_PRIORITY_PRESETS. Each preset must expand ONLY to target tokens the resolver
// already validates, so a preset can never widen the opted-in audience — it can only
// narrow + rank it. These tests are the contract between the dropdown and the send path.

describe("SMS_PRIORITY_PRESETS", () => {
  it("has a distinct value for every preset, incl. the whole-list 'all'", () => {
    const values = SMS_PRIORITY_PRESETS.map((p) => p.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain("all");
    expect(SMS_PRIORITY_PRESETS.every((p) => isSmsPriorityPreset(p.value))).toBe(true);
    expect(isSmsPriorityPreset("nope")).toBe(false);
  });

  it("the 'all' preset carries no tokens — the whole opted-in list, ranked", () => {
    const all = SMS_PRIORITY_PRESETS.find((p) => p.value === "all")!;
    expect(all.segments).toEqual([]);
    expect(presetTokens(all)).toEqual([]);
  });

  it("references only real voter segment names (never MONITOR — priority 0, never funded)", () => {
    for (const p of SMS_PRIORITY_PRESETS) {
      for (const s of p.segments) {
        expect(VOTER_SEGMENT_NAMES as readonly string[]).toContain(s);
        expect(s).not.toBe("MONITOR");
      }
    }
  });

  it("expands every preset to tokens that all pass parseTargetToken", () => {
    for (const p of SMS_PRIORITY_PRESETS) {
      for (const tok of presetTokens(p)) {
        expect(parseTargetToken(tok)).not.toBeNull();
      }
    }
  });

  it("emits segment:<NAME> tokens (+ 'outstanding' only for a GOTV-chase preset)", () => {
    const gotvChase = SMS_PRIORITY_PRESETS.find((p) => p.outstanding)!;
    expect(gotvChase.value).toBe("gotv-chase");
    const tokens = presetTokens(gotvChase);
    expect(tokens).toContain(OUTSTANDING_TOKEN);
    expect(tokens.filter((t) => t.startsWith("segment:"))).toEqual(["segment:MOBILIZE", "segment:BANK"]);

    // A non-outstanding preset emits no GOTV-chase token.
    const top = SMS_PRIORITY_PRESETS.find((p) => p.value === "top")!;
    expect(presetTokens(top)).toEqual(["segment:MOBILIZE", "segment:BANK"]);
  });

  it("orders segments highest-likelihood first (MOBILIZE before BANK before PERSUADE)", () => {
    // VOTER_SEGMENT_NAMES is the send-path priority order; a preset's segments must
    // follow it so the dropdown label reads in the same order a cap cuts.
    const rank = (s: string) => (VOTER_SEGMENT_NAMES as readonly string[]).indexOf(s);
    for (const p of SMS_PRIORITY_PRESETS) {
      const ranks = p.segments.map(rank);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});
