import { CAMPAIGN } from "@/lib/site";
import { trimHeadline } from "@/lib/social/headline";

// Build the /api/graphics URL for a branded card. Single source of truth shared by
// GraphicPicker (the live preview) and the /social share actions, so the button that
// shares "the image on screen" always points at the exact same graphic.
export function graphicSrc(o: { format: string; theme: string; photo: boolean; headline: string; sub?: string }): string {
  const params = new URLSearchParams({
    format: o.format,
    theme: o.theme,
    headline: trimHeadline(o.headline, 90),
    sub: o.sub ?? CAMPAIGN.committee,
    photo: o.photo ? "1" : "0",
  });
  return `/api/graphics?${params.toString()}`;
}
