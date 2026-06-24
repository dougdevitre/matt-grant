import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings and paragraphs", () => {
    const html = renderMarkdown("# Title\n\nHello world.");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>Hello world.</p>");
  });

  it("renders unordered and ordered lists", () => {
    expect(renderMarkdown("- a\n- b")).toBe("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
    expect(renderMarkdown("1. a\n2. b")).toBe("<ol>\n<li>a</li>\n<li>b</li>\n</ol>");
  });

  it("renders bold, italic, and code", () => {
    expect(renderMarkdown("**b** and *i* and `c`")).toBe("<p><strong>b</strong> and <em>i</em> and <code>c</code></p>");
  });

  it("does not corrupt bare numbers in text (code-span sentinel is collision-proof)", () => {
    expect(renderMarkdown("I have 3 cats and 5 dogs.")).toBe("<p>I have 3 cats and 5 dogs.</p>");
  });

  it("escapes HTML and only allows safe link hrefs", () => {
    expect(renderMarkdown("a <script>alert(1)</script> b")).not.toContain("<script>");
    expect(renderMarkdown("[x](https://ok.com)")).toContain('href="https://ok.com" target="_blank"');
    expect(renderMarkdown("[x](javascript:alert(1))")).toContain('href="#"');
  });

  it("renders a root-relative link without target=_blank", () => {
    const html = renderMarkdown("[vote](/vote)");
    expect(html).toContain('href="/vote"');
    expect(html).not.toContain("target=");
  });
});
