"use client";

import { useEffect, useState } from "react";

// A 3·2·1·GO overlay that gives the player a beat to orient before the action
// starts — a small thing that makes a game feel finished. Calls onDone when it
// finishes (or immediately under prefers-reduced-motion, so nothing is gated on
// an animation). Optional per-step tick sound via onTick.
const STEPS = ["3", "2", "1", "GO"];

export function StartCountdown({ onDone, onTick }: { onDone: () => void; onTick?: (i: number) => void }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    onTick?.(0);
    let n = 0;
    // Side effects (setI, onTick, onDone) run in the timer callback — never inside a
    // state updater — so we don't setState-during-render of a sibling component.
    const id = setInterval(() => {
      n += 1;
      if (n >= STEPS.length) {
        clearInterval(id);
        onDone();
        return;
      }
      onTick?.(n);
      setI(n);
    }, 650);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" aria-hidden="true">
      <span key={i} className="sc-pop font-display text-6xl font-bold text-ink drop-shadow sm:text-7xl">
        {STEPS[i]}
      </span>
      <style jsx>{`
        .sc-pop {
          animation: sc-pop 640ms ease-out both;
        }
        @keyframes sc-pop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          30% {
            opacity: 1;
            transform: scale(1.15);
          }
          70% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}
