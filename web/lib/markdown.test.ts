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

  it("renders a GFM table with header and body cells", () => {
    const html = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<thead><tr><th>A</th><th>B</th></tr></thead>");
    expect(html).toContain("<tbody><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></tbody>");
    expect(html).toContain('<div class="overflow-x-auto">');
  });

  it("applies per-column alignment from the delimiter row", () => {
    const html = renderMarkdown("| L | C | R |\n|:--|:-:|--:|\n| a | b | c |");
    expect(html).toContain('<th style="text-align:left">L</th>');
    expect(html).toContain('<th style="text-align:center">C</th>');
    expect(html).toContain('<th style="text-align:right">R</th>');
    expect(html).toContain('<td style="text-align:right">c</td>');
  });

  it("renders inline formatting inside table cells", () => {
    const html = renderMarkdown("| Name | Link |\n|---|---|\n| **bold** | [x](/y) |");
    expect(html).toContain("<td><strong>bold</strong></td>");
    expect(html).toContain('<td><a href="/y">x</a></td>');
  });

  it("does not treat a pipe line without a delimiter row as a table", () => {
    const html = renderMarkdown("a | b | c");
    expect(html).toBe("<p>a | b | c</p>");
  });

  it("does not treat a horizontal rule as a table delimiter", () => {
    const html = renderMarkdown("intro\n\n---\n\nmore");
    expect(html).toContain("<hr />");
    expect(html).not.toContain("<table>");
  });

  it("renders a mermaid fence as a .mermaid div, not a code block", () => {
    const html = renderMarkdown("```mermaid\ngraph TD\nA-->B\n```");
    expect(html).toContain('<div class="mermaid">');
    expect(html).toContain("A--&gt;B"); // escaped source; browser decodes via textContent
    expect(html).not.toContain("<pre><code>");
  });

  it("keeps non-mermaid fences as code blocks", () => {
    const html = renderMarkdown("```js\nconst x = 1;\n```");
    expect(html).toContain("<pre><code>const x = 1;</code></pre>");
    expect(html).not.toContain('class="mermaid"');
  });
});
