"use client";

import { useEffect, useRef, useState } from "react";
import { ASSETS_CDN } from "@/lib/site";

const SRC = `${ASSETS_CDN}/public/video/mg-video-fixing-missouris-broken-system.mp4`;

// Silent, looping background video for the hero. Autoplays only when the user
// hasn't asked to reduce motion; muted + playsInline so mobile browsers allow
// inline autoplay. Decorative, so it's hidden from assistive tech.
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [play, setPlay] = useState(false);

  // Defer the decorative video until the browser is idle, so its bytes don't
  // compete with the critical render / LCP on first load. Falls back to a short
  // timeout where requestIdleCallback isn't available (Safari).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setPlay(true), { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setPlay(true), 1500);
    return () => clearTimeout(t);
  }, []);

  // Once mounted, make sure it plays (belt-and-suspenders alongside autoPlay).
  useEffect(() => {
    if (play) ref.current?.play().catch(() => {});
  }, [play]);

  if (!play) return null;

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover opacity-90 motion-safe:animate-fade-in"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    >
      <source src={SRC} type="video/mp4" />
    </video>
  );
}
