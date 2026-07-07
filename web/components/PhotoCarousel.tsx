"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { CarouselSlide } from "@/lib/site";

// Horizontal photo carousel for the homepage. Built on native CSS scroll-snap
// (no third-party slider lib, matching the house style): the track is the
// scroll container and each slide snaps to center. Prev/next buttons and dots
// drive it by scrolling; a scroll listener keeps the active index in sync.
// Gentle autoplay advances every AUTOPLAY_MS but pauses on hover/focus and when
// the tab is hidden, and is disabled entirely under prefers-reduced-motion.
const AUTOPLAY_MS = 6000;

export function PhotoCarousel({ slides }: { slides: CarouselSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = slides.length;

  // Scroll a given slide into view. `smooth` is ignored by the browser when the
  // user prefers reduced motion (globals.css forces scroll-behavior: auto there).
  const goTo = useCallback((index: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = ((index % count) + count) % count;
    const child = track.children[clamped] as HTMLElement | undefined;
    if (child) track.scrollTo({ left: child.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }, [count]);

  // Keep `active` in sync as the user scrolls/swipes the track directly.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const center = track.scrollLeft + track.clientWidth / 2;
        let nearest = 0;
        let best = Infinity;
        Array.from(track.children).forEach((c, i) => {
          const el = c as HTMLElement;
          const mid = el.offsetLeft + el.offsetWidth / 2;
          const d = Math.abs(mid - center);
          if (d < best) { best = d; nearest = i; }
        });
        setActive(nearest);
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => { track.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, []);

  // Autoplay — off for a single slide, when paused, or under reduced motion.
  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => goTo(active + 1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [active, paused, count, goTo]);

  // Pause autoplay while the tab is hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (count === 0) return null;

  return (
    <div
      className="relative"
      role="group"
      aria-roledescription="carousel"
      aria-label="Campaign photos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
      }}
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-0 overflow-x-auto rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        tabIndex={0}
        aria-label="Photo track — use the arrow keys or the buttons to move between photos"
      >
        {slides.map((s, i) => (
          <figure
            key={s.src1600}
            className="relative aspect-[16/9] w-full shrink-0 snap-center overflow-hidden border border-line bg-ink shadow-card"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <Image
              src={s.src1600}
              alt={s.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 1100px"
              className="object-cover"
              priority={i === 0}
            />
            {s.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent px-5 pb-4 pt-12 text-sm text-paper sm:text-base">
                {s.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden><path d="M15 5l-7 7 7 7z" /></svg>
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden><path d="M9 5l7 7-7 7z" /></svg>
          </button>

          <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Choose a photo">
            {slides.map((s, i) => (
              <button
                key={s.src1600}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Photo ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === active ? "w-6 bg-brick" : "w-2.5 bg-line hover:bg-slate"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
