import { describe, it, expect } from "vitest";
import { externalHttpUrl } from "./url";

describe("externalHttpUrl", () => {
  it("passes through absolute http(s) URLs", () => {
    expect(externalHttpUrl("https://en.wikipedia.org/wiki/X")).toBe("https://en.wikipedia.org/wiki/X");
    expect(externalHttpUrl("http://news.google.com/a?b=1")).toBe("http://news.google.com/a?b=1");
    expect(externalHttpUrl("  https://x.co/a  ")).toBe("https://x.co/a"); // trimmed
  });

  it("drops javascript:/data: and other non-http schemes (the XSS vector)", () => {
    expect(externalHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(externalHttpUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(externalHttpUrl("vbscript:msgbox")).toBeUndefined();
    expect(externalHttpUrl("mailto:a@b.co")).toBeUndefined(); // not an external page link here
  });

  it("drops relative/unparseable strings and empty values", () => {
    expect(externalHttpUrl("/dashboard")).toBeUndefined();
    expect(externalHttpUrl("not a url")).toBeUndefined();
    expect(externalHttpUrl("")).toBeUndefined();
    expect(externalHttpUrl(null)).toBeUndefined();
    expect(externalHttpUrl(undefined)).toBeUndefined();
  });
});
