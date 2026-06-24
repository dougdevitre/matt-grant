import { describe, it, expect } from "vitest";
import { flagProfanity } from "@/lib/sms/moderation";

describe("flagProfanity", () => {
  it("flags a whole-word profanity, case-insensitively", () => {
    expect(flagProfanity("you are an idiot").flagged).toBe(false); // not on the list
    const r = flagProfanity("This is SHIT and you know it");
    expect(r.flagged).toBe(true);
    expect(r.terms).toContain("shit");
  });

  it("does not flag clean text", () => {
    expect(flagProfanity("Thanks for the info, see you Saturday!").flagged).toBe(false);
    expect(flagProfanity("").flagged).toBe(false);
  });

  it("does not flag a bad word embedded inside a benign word", () => {
    // Whole-word boundary: "Scunthorpe"/"assassin"/"classic" must not trip it.
    expect(flagProfanity("We met in Scunthorpe to discuss the classic assassin novel").flagged).toBe(false);
  });

  it("dedupes repeated terms", () => {
    const r = flagProfanity("shit shit shit");
    expect(r.terms).toEqual(["shit"]);
  });
});
