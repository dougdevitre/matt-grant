import { describe, it, expect } from "vitest";
import { brandFonts } from "@/lib/fonts/brandFonts";

// The core of the hardening change: the image generator now loads its typefaces from
// committed .woff2 on disk instead of Google Fonts at request time. This proves the
// local files load (no network) so a Google Fonts outage can't silently downgrade the
// brand font on generated cards.
describe("brandFonts — self-hosted image fonts", () => {
  it("loads Fraunces 700 + Public Sans 600 from disk as real woff (v1, satori-decodable)", async () => {
    const fonts = await brandFonts("A headline", "MISSOURI · DISTRICT 2");
    expect(fonts).toHaveLength(2);

    const byName = Object.fromEntries(fonts.map((f) => [f.name, f]));
    expect(byName["Fraunces"]?.weight).toBe(700);
    expect(byName["Public Sans"]?.weight).toBe(600);

    for (const f of fonts) {
      expect(f.style).toBe("normal");
      expect(f.data.byteLength).toBeGreaterThan(1000); // real font bytes, not empty
      const sig = String.fromCharCode(...new Uint8Array(f.data.slice(0, 4)));
      expect(sig, `${f.name} should be a woff (v1)`).toBe("wOFF");
    }
  });
});
