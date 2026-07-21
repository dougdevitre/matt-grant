import { describe, it, expect, vi, afterEach } from "vitest";
import { canShareFiles, shareImageFile } from "@/lib/social/nativeShare";
import { CAMPAIGN } from "@/lib/site";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("canShareFiles", () => {
  it("is false when navigator.canShare is absent", () => {
    vi.stubGlobal("navigator", {});
    expect(canShareFiles()).toBe(false);
  });

  it("is true when navigator.canShare accepts a file payload", () => {
    vi.stubGlobal("navigator", { canShare: (o: { files?: unknown[] }) => Array.isArray(o.files) });
    expect(canShareFiles()).toBe(true);
  });
});

describe("shareImageFile", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "matt-grant.png", { type: "image/png" });
  const args = { imageUrl: "/api/graphics?x=1", filename: "matt-grant.png", text: `Vote — ${CAMPAIGN.paidForBy}`, title: CAMPAIGN.committee };

  it("uses the native share sheet with the file when supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: () => true, share });
    const outcome = await shareImageFile({ file, ...args });
    expect(outcome).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    const payload = share.mock.calls[0][0];
    expect(payload.files).toEqual([file]);
    expect(payload.text).toContain(CAMPAIGN.paidForBy);
  });

  it("returns 'cancelled' when the user dismisses the sheet", async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error("dismiss"), { name: "AbortError" }));
    vi.stubGlobal("navigator", { canShare: () => true, share });
    expect(await shareImageFile({ file, ...args })).toBe("cancelled");
  });

  it("falls back to copy-caption + download when file share is unsupported", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: () => false, clipboard: { writeText } });
    const clicked = vi.fn();
    const anchor: Record<string, unknown> = { click: clicked, remove: vi.fn(), setAttribute: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });

    const outcome = await shareImageFile({ file, ...args });
    expect(outcome).toBe("downloaded");
    expect(writeText).toHaveBeenCalledWith(args.text);
    expect(clicked).toHaveBeenCalledOnce(); // image download triggered
    expect(anchor.download).toBe("matt-grant.png");
  });
});
