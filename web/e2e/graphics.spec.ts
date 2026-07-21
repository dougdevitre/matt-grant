import { test, expect } from "@playwright/test";

// End-to-end render smoke test for the /api/graphics image generator. The satori
// render path (fonts + layout tree + PNG encode) had no coverage — only the pure
// layout math. This hits the real route in the built Next server and asserts a valid
// PNG comes back for every format, catching 500s, font-load breaks, and broken flex
// trees that the unit tests can't. Because these images carry the FEC "Paid for by"
// disclaimer, a silent render break is also a compliance break — so this is a gate.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const FORMATS = ["ig_square", "ig_story", "x_header", "fb_cover", "yard_sign", "web_banner"];
const HEADLINE = encodeURIComponent("Early voting is open now — make your plan today");

test.describe("/api/graphics renders valid PNGs", () => {
  for (const format of FORMATS) {
    test(`format=${format}`, async ({ request }) => {
      const res = await request.get(`/api/graphics?format=${format}&theme=brick&headline=${HEADLINE}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
      const body = await res.body();
      expect(body.subarray(0, 4).equals(PNG_MAGIC), "PNG magic bytes").toBeTruthy();
      expect(body.length).toBeGreaterThan(2000); // a real rendered image, not a stub
    });
  }

  test("themes + photo-off + empty/long headlines all render 200", async ({ request }) => {
    const cases = [
      "format=ig_square&theme=navy&headline=Vote%20August%204",
      "format=ig_square&theme=paper&headline=Vote%20August%204",
      "format=ig_square&theme=brick&photo=0&headline=Vote%20August%204",
      "format=ig_story&theme=navy&headline=",
      `format=x_header&theme=brick&headline=${encodeURIComponent("supercalifragilistic ".repeat(20))}`,
    ];
    for (const q of cases) {
      const res = await request.get(`/api/graphics?${q}`);
      expect(res.status(), q).toBe(200);
      expect((await res.body()).subarray(0, 4).equals(PNG_MAGIC), q).toBeTruthy();
    }
  });
});
