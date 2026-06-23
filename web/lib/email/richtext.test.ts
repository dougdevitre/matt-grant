import { describe, it, expect } from "vitest";
import { escapeHtml, safeUrl, richToEmailHtml, richToText } from "./richtext";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });
});

describe("safeUrl", () => {
  it("allows http(s), mailto, tel, in-page, and site-relative URLs", () => {
    expect(safeUrl("https://x.co/a?b=1&c=2")).toBe("https://x.co/a?b=1&c=2");
    expect(safeUrl("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(safeUrl("tel:+13145557760")).toBe("tel:+13145557760");
    expect(safeUrl("#section")).toBe("#section");
    expect(safeUrl("/issues")).toBe("/issues");
  });
  it("neutralizes dangerous schemes to #", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl(" JavaScript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,<script>")).toBe("#");
    expect(safeUrl("vbscript:msgbox(1)")).toBe("#");
  });
});

describe("richToEmailHtml", () => {
  it("returns empty string for empty/blank input", () => {
    expect(richToEmailHtml("")).toBe("");
    expect(richToEmailHtml("   \n  ")).toBe("");
  });

  it("splits blank-line-separated blocks into paragraphs and single newlines into <br>", () => {
    const html = richToEmailHtml("First line\nsecond line\n\nNew paragraph");
    expect(html).toContain("First line<br>second line");
    expect((html.match(/<p /g) ?? []).length).toBe(2);
    expect(html).toContain("New paragraph");
  });

  it("renders bold, italic, and safe links", () => {
    const html = richToEmailHtml("Give **today** or *soon* via [donate](https://x.co/give)");
    expect(html).toContain("<strong>today</strong>");
    expect(html).toContain("<em>soon</em>");
    expect(html).toContain('href="https://x.co/give"');
    expect(html).toContain(">donate</a>");
  });

  it("renders - / * bullet blocks as a list", () => {
    const html = richToEmailHtml("- one\n- two");
    expect((html.match(/<li /g) ?? []).length).toBe(2);
    expect(html).toContain("<ul ");
    expect(html).toContain(">one</li>");
  });

  it("escapes all raw HTML — no injection survives", () => {
    const html = richToEmailHtml('<script>alert(1)</script> & <b>x</b>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("neutralizes a javascript: link to #", () => {
    const html = richToEmailHtml("[click](javascript:alert(1))");
    expect(html).toContain('href="#"');
    expect(html).not.toContain("javascript:");
  });
});

describe("richToText", () => {
  it("flattens markers and renders links as 'label (url)'", () => {
    expect(richToText("Give **today** or *soon* via [donate](https://x.co)")).toBe(
      "Give today or soon via donate (https://x.co)",
    );
  });
});
