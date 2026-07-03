import { describe, it, expect, afterEach } from "vitest";
import { CAPTIONED, captionTrackFor, videoBasename } from "./captions";

describe("videoBasename", () => {
  it("strips the CDN/path prefix, query, and .mp4 extension", () => {
    expect(videoBasename("https://cdn.example.net/public/video/mg-video-family-courts.mp4")).toBe(
      "mg-video-family-courts",
    );
    expect(videoBasename("/public/video/mg-video-x.mp4?v=2")).toBe("mg-video-x");
    expect(videoBasename("mg-video-y.MP4")).toBe("mg-video-y");
  });
});

describe("captionTrackFor", () => {
  afterEach(() => CAPTIONED.delete("mg-video-test"));

  it("returns null when no authored .vtt is registered (no fake tracks)", () => {
    expect(captionTrackFor("https://cdn/public/video/mg-video-unregistered.mp4")).toBeNull();
  });

  it("returns an English same-origin track for a registered basename", () => {
    CAPTIONED.add("mg-video-test");
    expect(captionTrackFor("https://cdn/public/video/mg-video-test.mp4")).toEqual({
      src: "/video/mg-video-test.en.vtt",
      srclang: "en",
      label: "English",
    });
  });
});
