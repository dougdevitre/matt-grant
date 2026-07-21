import { track } from "@/lib/analytics";

// One-tap sharing for /social. The Web Share API with a `files` payload is the only
// web capability that hands a target app BOTH the caption and the image: on a phone
// navigator.share() opens the native share sheet pre-loaded with the graphic + text,
// and one tap on any app (Instagram, X, Facebook, TikTok, Threads…) opens it ready to
// post. It's channel-agnostic (the app is chosen in the OS sheet) and mostly mobile;
// where it's unavailable we fall back to copy-caption + download-image. Both halves
// carry the "Paid for by" disclaimer (text via renderChannelText, image baked by
// /api/graphics), so every share is compliant.

export type ShareOutcome = "shared" | "downloaded" | "cancelled" | "error";

/** True when the browser can share image files (mostly mobile Safari/Chrome). */
export function canShareFiles(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
    const probe = new File([new Uint8Array([0])], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Fetch the (same-origin, public) /api/graphics PNG as a File. null on failure. */
export async function toImageFile(url: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "image/png" });
  } catch {
    return null;
  }
}

function triggerDownload(href: string, filename: string, revoke = false): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 4000);
}

/** Copy the caption and save the image — the fallback when the share sheet isn't available. */
async function copyAndDownload(text: string, file: File | null, imageUrl: string, filename: string): Promise<void> {
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    /* clipboard blocked — the caption is still visible/copyable in the UI */
  }
  if (file) triggerDownload(URL.createObjectURL(file), filename, true);
  else if (imageUrl) triggerDownload(imageUrl, filename);
}

// Hero share. `file` should be pre-fetched (so navigator.share fires within the click's
// user-activation window); if it's null we still fall back gracefully.
export async function shareImageFile(o: {
  file: File | null;
  imageUrl: string;
  filename: string;
  text: string;
  title: string;
  channel?: string;
}): Promise<ShareOutcome> {
  if (o.file && canShareFiles()) {
    try {
      await navigator.share({ title: o.title, text: o.text, files: [o.file] });
      track("share_click", { method: "web_share", channel: o.channel ?? "sheet" });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled"; // user dismissed the sheet
      // any other error → fall through to the download fallback
    }
  }
  await copyAndDownload(o.text, o.file, o.imageUrl, o.filename);
  track("share_click", { method: "download", channel: o.channel ?? "fallback" });
  return o.file || o.imageUrl ? "downloaded" : "error";
}

// Per-channel "Post to [platform]": open the channel's compose/upload surface in a new
// tab (synchronously, to keep the click's popup permission), then copy the caption +
// save the image in the background so the user can paste + attach.
export function postToChannel(o: { openUrl: string; imageUrl: string; filename: string; text: string; channel: string }): void {
  window.open(o.openUrl, "_blank", "noopener,noreferrer");
  void (async () => {
    const file = await toImageFile(o.imageUrl, o.filename);
    await copyAndDownload(o.text, file, o.imageUrl, o.filename);
    track("share_click", { method: "open_channel", channel: o.channel });
  })();
}
