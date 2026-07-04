import { describe, it, expect } from "vitest";
import { isPublicImage, isStudioGraphic, publicSocialKey } from "./assetMedia";

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

// The Studio tab is a tagged subset of public assets (no separate data source).
describe("isStudioGraphic", () => {
  it("matches a public image tagged studio", () => {
    expect(isStudioGraphic({ kind: "image", visibility: "public", name: "x.png", tags: ["studio"] })).toBe(true);
  });

  it("matches an older Studio save by its matt-grant- name (predates the tag)", () => {
    expect(isStudioGraphic({ kind: "image", visibility: "public", name: "matt-grant-ig_square.png", tags: [] })).toBe(true);
  });

  it("ignores an unrelated public image", () => {
    expect(isStudioGraphic({ kind: "image", visibility: "public", name: "rally.jpg", tags: ["event"] })).toBe(false);
  });

  it("never matches a private image", () => {
    expect(isStudioGraphic({ kind: "image", visibility: "private", name: "matt-grant-x.png", tags: ["studio"] })).toBe(false);
  });
});

// Promoting a private photo derives a STABLE public key so re-promoting overwrites
// the same object instead of piling up duplicates.
describe("publicSocialKey", () => {
  it("maps a private photo key to a deterministic public/social/ key", () => {
    expect(publicSocialKey("private/photos/events/mg-rally.jpg")).toBe("public/social/photos-events-mg-rally.jpg");
  });

  it("is idempotent — same source always yields the same key", () => {
    const k = "private/photos/candidate/headshot.heic";
    expect(publicSocialKey(k)).toBe(publicSocialKey(k));
  });

  it("collapses unsafe characters into single dashes", () => {
    expect(publicSocialKey("private/photos/district/Main St & 3rd.jpg")).toBe("public/social/photos-district-Main-St-3rd.jpg");
  });
});
