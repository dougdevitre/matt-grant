// Promoted real photos (from promote-photo.mjs). Pages look one up by name and
// fall back to a brand-scene placeholder until a real photo is promoted — so
// swapping a placeholder for authentic photography is a one-liner:
//
//   const hero = webPhoto("district-rally");
//   <Image src={hero?.sizes["1600"] ?? `${ASSETS_CDN}/public/web/st-louis-arch.png`} alt={hero?.alt ?? ""} ... />
import data from "./webPhotos.json";

export type WebPhoto = { name: string; alt: string; source: string; sizes: Record<string, string> };

const PHOTOS = (data.photos ?? []) as WebPhoto[];

export function webPhoto(name: string): WebPhoto | null {
  return PHOTOS.find((p) => p.name === name) ?? null;
}
