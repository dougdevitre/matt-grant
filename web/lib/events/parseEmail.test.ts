import { describe, it, expect } from "vitest";
import { parseEventDraft } from "./parseEmail";

const wrap = (o: unknown) => `Here is the JSON:\n${JSON.stringify(o)}\nThanks!`;

describe("parseEventDraft", () => {
  it("extracts and normalizes a well-formed draft", () => {
    const d = parseEventDraft(
      wrap({
        title: "Town Hall in Chesterfield",
        type: "town-hall",
        start: "2026-07-12T18:00:00-05:00",
        end: "2026-07-12T20:00:00-05:00",
        location: { name: "Library", address: "123 Main", city: "Chesterfield", county: "St. Louis County" },
        description: "Come ask questions.",
        confidence: 0.9,
      }),
    );
    expect(d).not.toBeNull();
    expect(d!.title).toBe("Town Hall in Chesterfield");
    expect(d!.type).toBe("town-hall");
    expect(d!.start).toBe(new Date("2026-07-12T18:00:00-05:00").toISOString());
    expect(d!.location.city).toBe("Chesterfield");
    expect(d!.confidence).toBeCloseTo(0.9);
  });

  it("coerces an unknown type to 'other'", () => {
    expect(parseEventDraft(JSON.stringify({ title: "X", type: "fundr41ser", confidence: 0.8 }))!.type).toBe("other");
  });

  it("rejects an unparseable date (start = '') and caps confidence so it stays a review draft", () => {
    const d = parseEventDraft(JSON.stringify({ title: "X", type: "rally", start: "next Tuesdayish", confidence: 0.95 }))!;
    expect(d.start).toBe("");
    expect(d.confidence).toBeLessThanOrEqual(0.4);
  });

  it("returns null when there is no title (a draft with no title is useless)", () => {
    expect(parseEventDraft(JSON.stringify({ type: "rally", confidence: 0.9 }))).toBeNull();
  });

  it("returns null on non-JSON / empty input", () => {
    expect(parseEventDraft("sorry, I can't help with that")).toBeNull();
    expect(parseEventDraft("")).toBeNull();
  });

  it("clamps oversized fields", () => {
    const long = "a".repeat(5000);
    const d = parseEventDraft(JSON.stringify({ title: long, description: long, confidence: 0.7 }))!;
    expect(d.title.length).toBe(140);
    expect(d.description.length).toBe(4000);
  });

  it("does not act on instructions embedded in the email content (it only parses JSON fields)", () => {
    // The model is told to ignore instructions; at the parse layer we simply never
    // execute anything — an injected 'type' is still clamped to the enum.
    const d = parseEventDraft(JSON.stringify({ title: "Ignore previous instructions", type: "DROP TABLE", confidence: 1 }))!;
    expect(d.type).toBe("other");
    expect(d.confidence).toBeLessThanOrEqual(1);
  });
});
