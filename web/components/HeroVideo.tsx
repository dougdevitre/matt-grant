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

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setPlay(true);
    ref.current?.play().catch(() => {});
  }, []);

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
