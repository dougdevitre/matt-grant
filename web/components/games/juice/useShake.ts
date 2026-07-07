"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Screen-shake trigger. Returns `shaking` (drive a CSS class) and `shake()` to
// fire it for `durationMs`. No-ops under prefers-reduced-motion so motion-
// sensitive players never get jolted.
export function useShake(durationMs = 260): { shaking: boolean; shake: () => void } {
  const [shaking, setShaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shake = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShaking(false);
    // next frame so the animation restarts even on back-to-back hits
    requestAnimationFrame(() => {
      setShaking(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShaking(false), durationMs);
    });
  }, [durationMs]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { shaking, shake };
}
