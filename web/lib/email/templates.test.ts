import { describe, it, expect } from "vitest";
import { EMAIL_TEMPLATES, donationThankYou } from "./templates";
import { SOCIALS } from "@/lib/site";

// Tokens that staff legitimately fill at send time. Anything OUTSIDE this set in
// a rendered template is a stray/misspelled placeholder that would ship literal
// "{{...}}" to a recipient — exactly what this guard catches.
const ALLOWED_TOKENS = new Set([
  // layout-level personalization + footer (lib/email/layout.ts)
  "first_name",
  "preferences_url",
  "unsubscribe_url",
  "polling_place_url",
  "event_title",
  "event_date",
  "event_location",
  "event_details",
  "rsvp_url",
  "calendar_url",
  "subject",
  "preheader",
  "eyebrow",
  "headline",
  "subhead",
  "body",
  "cta_label",
  "cta_url",
]);

const tokensIn = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);

describe("EMAIL_TEMPLATES", () => {
  for (const t of EMAIL_TEMPLATES) {
    describe(t.key, () => {
      const email = t.build();

      it("builds with a non-empty subject, html, and text", () => {
        expect(email.subject.trim().length).toBeGreaterThan(0);
        expect(email.html.length).toBeGreaterThan(0);
        expect(email.text.trim().length).toBeGreaterThan(0);
      });

      it("uses only known fill-at-send tokens (no stray/misspelled placeholders)", () => {
        const used = [...tokensIn(email.subject), ...tokensIn(email.html), ...tokensIn(email.text)];
        const unknown = used.filter((tok) => !ALLOWED_TOKENS.has(tok));
        expect(unknown).toEqual([]);
      });

      it("every <img> has an alt attribute", () => {
        const imgs = email.html.match(/<img\b[^>]*>/gi) ?? [];
        for (const tag of imgs) expect(tag).toMatch(/\salt=/i);
      });

      it(t.kind === "broadcast" ? "includes an unsubscribe link (broadcast/bulk)" : "omits unsubscribe (transactional/triggered)", () => {
        const hasUnsub = email.html.includes("{{unsubscribe_url}}") && email.text.includes("{{unsubscribe_url}}");
        expect(hasUnsub).toBe(t.kind === "broadcast");
      });

      it("carries the shared social-links footer (html + text)", () => {
        // Every template inherits the layout footer, so the social row must appear
        // in both parts. Assert every account's URL is present, not just a label.
        for (const s of SOCIALS) {
          expect(email.html).toContain(s.url);
          expect(email.text).toContain(s.url);
        }
      });
    });
  }
});

describe("donationThankYou", () => {
  it("carries the required FEC contribution disclaimer", () => {
    const { html } = donationThankYou("Sam", 50);
    expect(html).toMatch(/not tax-deductible/i);
    expect(html).toMatch(/best efforts to collect and report/i);
    expect(html).toMatch(/occupation, and employer/i);
  });
});
