// WCAG 1.2.2 caption wiring for the site's <video> players.
//
// Videos are served from the CDN (ASSETS_CDN), but caption files live SAME-ORIGIN
// under web/public/video/<basename>.en.vtt so the <track> loads without any CDN
// CORS setup. This module is the single seam that decides whether a given video
// has captions: a <track> is rendered ONLY when a real .vtt has been authored and
// its basename registered below. An empty CAPTIONED set means we claim no
// captions — never a fake or empty track (which is worse than none for a11y).
//
// To add captions for a video: author web/public/video/<basename>.en.vtt from the
// video's audio, then add "<basename>" to CAPTIONED. See web/public/video/README.md.

export const CAPTIONED = new Set<string>([
  // e.g. "mg-video-family-courts"  ← add once its .en.vtt exists
]);

export type CaptionTrack = { src: string; srclang: string; label: string };

/** The file stem of a video URL: last path segment, minus query/hash and `.mp4`. */
export function videoBasename(videoUrl: string): string {
  const path = videoUrl.split(/[?#]/)[0];
  const seg = path.slice(path.lastIndexOf("/") + 1);
  return seg.replace(/\.mp4$/i, "");
}

/**
 * Caption <track> props for a video URL, or null when no authored .vtt exists.
 * Same-origin src (/video/<basename>.en.vtt) — no crossOrigin needed on the video.
 */
export function captionTrackFor(videoUrl: string): CaptionTrack | null {
  const base = videoBasename(videoUrl);
  if (!base || !CAPTIONED.has(base)) return null;
  return { src: `/video/${base}.en.vtt`, srclang: "en", label: "English" };
}
