"use client";

import { useState } from "react";

// Click-to-play facade for the campaign's YouTube explainer-video playlist.
// Nothing loads from YouTube until the visitor presses play: the cover is a
// self-contained, on-brand panel, so no third-party request fires on page load
// (keeps the homepage in line with the site's "nothing is submitted" posture).
// Uses youtube-nocookie.com so playback itself sets no tracking cookies.
const PLAYLIST_ID = "PLfSzC6c9Q5sw";
const EMBED = `https://www.youtube-nocookie.com/embed/videoseries?list=${PLAYLIST_ID}&rel=0`;

export function VideoPlaylist() {
  const [play, setPlay] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-ink shadow-card">
      {play ? (
        <iframe
          src={`${EMBED}&autoplay=1`}
          title="Matt Grant for Congress — explainer video series"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlay(true)}
          aria-label="Play the explainer video series"
          className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-ink via-field/40 to-ink text-paper"
        >
          <span className="absolute inset-0 bg-grid opacity-30 mix-blend-soft-light" aria-hidden />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gold shadow-card transition-transform group-hover:scale-105 motion-safe:group-hover:scale-110">
            {/* Play triangle */}
            <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-[2px] fill-paper" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="relative font-display text-lg font-semibold">Watch the series</span>
        </button>
      )}
    </div>
  );
}
