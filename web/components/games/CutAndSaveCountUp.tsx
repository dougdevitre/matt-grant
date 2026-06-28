"use client";

// Animates a number counting toward its latest value. Used for the "Relief funded"
// figure in the HUD so cuts feel like they're adding up. Purely cosmetic — the real
// value comes straight from sim state; this only smooths the *display*.
//
// Accessibility: under prefers-reduced-motion we snap to the value (no tween). The
// surrounding HUD already announces changes via aria-live, so the animated digits
// themselves are aria-hidden and a plain text node carries the real value to AT.

import { useEffect, useRef, useState } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CutAndSaveCountUp({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const DURATION = 450;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value]);

  return (
    <>
      <span aria-hidden="true" className={className}>
        {format(display)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
