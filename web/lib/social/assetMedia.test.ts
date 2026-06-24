import { describe, it, expect } from "vitest";
import { isPublicImage } from "./assetMedia";

// Only public images are valid social post media — private assets use short-lived
// presigned URLs that expire before a scheduled post sends, and PDFs/other aren't
// images. This guard is the single rule the picker filters on.
describe("isPublicImage", () => {
  it("accepts a public image", () => {
    expect(isPublicImage({ kind: "image", visibility: "public" })).toBe(true);
  });

  it("rejects a private image (presigned URL would expire before posting)", () => {
    expect(isPublicImage({ kind: "image", visibility: "private" })).toBe(false);
  });

  it("rejects a public PDF / non-image", () => {
    expect(isPublicImage({ kind: "pdf", visibility: "public" })).toBe(false);
    expect(isPublicImage({ kind: "other", visibility: "public" })).toBe(false);
  });
});
