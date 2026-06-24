import { describe, it, expect } from "vitest";
import { getBroadcast } from "./broadcasts";

// applyVars (exercised through build) is the boundary where staff-authored input
// lands in email markup. These tests pin its context-aware escaping so a
// regression can't quietly reintroduce an injection or a dead unsubscribe link.
const announcement = getBroadcast("announcement")!;

const baseVars = {
  subject: "Plain subject",
  preheader: "preview",
  eyebrow: "Big news",
  headline: "Headline",
  subhead: "Subhead",
  body: "Hello",
  cta_label: "Read more",
  cta_url: "https://example.com/x?a=1&b=2",
};

describe("broadcast build() / applyVars escaping", () => {
  it("HTML-escapes plain fields so markup can't be injected", () => {
    const out = announcement.build({ ...baseVars, headline: "<script>alert(1)</script>" });
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).not.toContain("<script>alert(1)</script>");
  });

  it("neutralizes a javascript: URL in a *_url field to '#'", () => {
    const out = announcement.build({ ...baseVars, cta_url: "javascript:alert(document.cookie)" });
    expect(out.html).not.toContain("javascript:");
    expect(out.html).toContain('href="#"');
  });

  it("keeps a legitimate https URL (ampersands escaped for the attribute)", () => {
    const out = announcement.build(baseVars);
    expect(out.html).toContain("https://example.com/x?a=1&amp;b=2");
  });

  it("sanitizes a rich field: markdown renders, raw HTML is escaped", () => {
    const out = announcement.build({ ...baseVars, body: "**bold** and <b>raw</b>" });
    expect(out.html).toContain("<strong>bold</strong>");
    expect(out.html).toContain("&lt;b&gt;raw&lt;/b&gt;");
    expect(out.html).not.toContain("<b>raw</b>");
  });

  it("leaves per-recipient tokens in place for the send layer to fill", () => {
    const out = announcement.build(baseVars);
    expect(out.html).toContain("{{unsubscribe_url}}");
  });

  it("subject + text use raw values (no HTML escaping); rich text is flattened", () => {
    const out = announcement.build({ ...baseVars, subject: "Q3 <results>", body: "**bold**" });
    expect(out.subject).toBe("Q3 <results>");
    expect(out.text).toContain("bold");
    expect(out.text).not.toContain("**");
  });
});
