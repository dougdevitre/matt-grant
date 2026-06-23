import { describe, it, expect } from "vitest";
import { sanitizeHttpUrl, sanitizeMediaUrl } from "@/lib/social/validate";

describe("sanitizeHttpUrl", () => {
  it("accepts absolute http(s) URLs and normalizes them", () => {
    expect(sanitizeHttpUrl("https://mattgrantforcongress.org/act")).toBe("https://mattgrantforcongress.org/act");
    expect(sanitizeHttpUrl("  http://example.com  ")).toBe("http://example.com/");
  });

  it("rejects javascript:, data:, and other non-http schemes", () => {
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeHttpUrl("data:text/html,<script>")).toBeUndefined();
    expect(sanitizeHttpUrl("ftp://example.com/x")).toBeUndefined();
  });

  it("rejects protocol-relative and relative values, and blanks", () => {
    expect(sanitizeHttpUrl("//evil.com")).toBeUndefined();
    expect(sanitizeHttpUrl("/act")).toBeUndefined();
    expect(sanitizeHttpUrl("not a url")).toBeUndefined();
    expect(sanitizeHttpUrl("")).toBeUndefined();
    expect(sanitizeHttpUrl(null)).toBeUndefined();
  });
});

describe("sanitizeMediaUrl", () => {
  it("allows a site-relative app path (the attach-graphic flow)", () => {
    expect(sanitizeMediaUrl("/api/graphics?format=ig_square")).toBe("/api/graphics?format=ig_square");
  });

  it("allows absolute http(s) but rejects protocol-relative and dangerous schemes", () => {
    expect(sanitizeMediaUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(sanitizeMediaUrl("//evil.com/a.png")).toBeUndefined();
    expect(sanitizeMediaUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeMediaUrl("")).toBeUndefined();
  });
});
