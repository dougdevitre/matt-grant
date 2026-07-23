import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { track } from "./analytics";

// These lib tests run in the node environment (no DOM), so stub `window` → globalThis;
// track() reads its providers off window.
type W = Record<string, unknown>;
const w = () => globalThis as unknown as W;

describe("track", () => {
  beforeEach(() => {
    vi.stubGlobal("window", globalThis);
    for (const k of ["gtag", "plausible", "posthog", "dataLayer", "fbq"]) delete w()[k];
  });
  afterEach(() => {
    for (const k of ["gtag", "plausible", "posthog", "dataLayer", "fbq"]) delete w()[k];
    vi.unstubAllGlobals();
  });

  it("forwards to GA (gtag) when present", () => {
    const gtag = vi.fn();
    w().gtag = gtag;
    track("cta_click", { label: "donate" });
    expect(gtag).toHaveBeenCalledWith("event", "cta_click", { label: "donate" });
  });

  it("forwards to the Meta Pixel INDEPENDENTLY of GA — both fire", () => {
    const gtag = vi.fn();
    const fbq = vi.fn();
    w().gtag = gtag;
    w().fbq = fbq;
    track("cta_click", { label: "donate" });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledWith("trackCustom", "cta_click", { label: "donate" });
  });

  it("fires the pixel even when GA is absent (pixel is not in the provider else-if chain)", () => {
    const fbq = vi.fn();
    w().fbq = fbq;
    track("quick_action_click", { action: "textMatt" });
    expect(fbq).toHaveBeenCalledWith("trackCustom", "quick_action_click", { action: "textMatt" });
  });

  it("is a silent no-op when nothing is installed", () => {
    expect(() => track("cta_click")).not.toThrow();
  });

  it("never throws if a provider throws", () => {
    w().fbq = () => {
      throw new Error("pixel blew up");
    };
    expect(() => track("cta_click")).not.toThrow();
  });
});
