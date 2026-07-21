import { describe, it, expect } from "vitest";
import { GRAPHIC_FORMATS, measureText, layoutFor, fitHeadline, balanceLines, familyOf, type GraphicFormatId } from "@/lib/social/graphicLayout";

const FORMAT_IDS = Object.keys(GRAPHIC_FORMATS) as GraphicFormatId[];

const HEADLINES = {
  tiny: "Vote.",
  short: "Put Missouri's children first.",
  medium: "Early voting is open now — make your plan today.",
  long: "You don't have to wait until August 4 — early voting is open now through Monday, Aug 3, so make your plan and bring a friend.",
  wideWords: "WASHINGTON MMMM WWWW accountability", // stress the wide-glyph estimate
};

describe("graphicLayout — fit-to-box headline sizing", () => {
  it("classifies each format's composition family", () => {
    expect(familyOf(GRAPHIC_FORMATS.ig_square)).toBe("square");
    expect(familyOf(GRAPHIC_FORMATS.ig_story)).toBe("portrait");
    expect(familyOf(GRAPHIC_FORMATS.x_header)).toBe("wide");
    expect(familyOf(GRAPHIC_FORMATS.web_banner)).toBe("wide");
  });

  it("layoutFor leaves a positive headline box and reserves a disclaimer band on every format", () => {
    for (const id of FORMAT_IDS) {
      const L = layoutFor(GRAPHIC_FORMATS[id], { photo: true, hasSub: true });
      expect(L.textBoxW, id).toBeGreaterThan(0);
      expect(L.headlineBoxH, id).toBeGreaterThan(0);
      expect(L.discBand, id).toBeGreaterThan(L.discSize);
      expect(L.headlineMinFont).toBeLessThanOrEqual(L.headlineMaxFont);
    }
  });

  it("MEASURED line width never overflows the box, for every headline on every format", () => {
    for (const id of FORMAT_IDS) {
      const L = layoutFor(GRAPHIC_FORMATS[id], { photo: true, hasSub: true });
      for (const [label, text] of Object.entries(HEADLINES)) {
        const fit = fitHeadline({ text, boxW: L.textBoxW, boxH: L.headlineBoxH, maxFont: L.headlineMaxFont, minFont: L.headlineMinFont });
        const where = `${id}/${label}`;
        expect(fit.fontSize, where).toBeGreaterThanOrEqual(L.headlineMinFont);
        expect(fit.fontSize, where).toBeLessThanOrEqual(L.headlineMaxFont);
        for (const line of fit.lines) {
          // Measured (not char-count) width must fit the real box.
          expect(measureText(line, fit.fontSize), `${where}: "${line}"`).toBeLessThanOrEqual(L.textBoxW);
        }
        if (fit.fontSize > L.headlineMinFont) {
          expect(fit.lines.length * fit.fontSize * fit.lineHeight, where).toBeLessThanOrEqual(L.headlineBoxH);
        }
        expect(fit.lines.join(" ").replace(/\s+/g, " ").trim()).toBe(text.replace(/\s+/g, " ").trim());
      }
    }
  });

  it("short headlines get a bigger font than long ones", () => {
    const L = layoutFor(GRAPHIC_FORMATS.ig_square, { photo: true, hasSub: true });
    const args = { boxW: L.textBoxW, boxH: L.headlineBoxH, maxFont: L.headlineMaxFont, minFont: L.headlineMinFont };
    expect(fitHeadline({ text: HEADLINES.short, ...args }).fontSize).toBeGreaterThan(
      fitHeadline({ text: HEADLINES.long, ...args }).fontSize,
    );
  });

  it("balanceLines avoids a lonely last word and preserves the text", () => {
    const words = "Early voting is open now make your plan today".split(" ");
    const lines = balanceLines(words, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join(" ")).toBe(words.join(" "));
    const widths = lines.map((l) => measureText(l, 100));
    expect(Math.max(...widths)).toBeLessThanOrEqual(Math.min(...widths) * 2.2);
  });
});
