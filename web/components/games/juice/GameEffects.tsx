"use client";

import { useCallback, useRef, useState } from "react";

// Presentation-only "juice" layer for a game: floating score popups and particle
// bursts, positioned in the parent's coordinate space (xPct across, bottomPx up).
// Mount `render` inside a `position: relative` container. Everything is cosmetic
// and self-expiring; under prefers-reduced-motion, particles are skipped and
// popups appear without motion. Randomness here is view-only (Math.random is fine;
// it never touches the deterministic sim).

type Tone = "good" | "bad" | "gold";

interface Floater {
  id: number;
  text: string;
  xPct: number;
  bottomPx: number;
  tone: Tone;
}
interface Burst {
  id: number;
  xPct: number;
  bottomPx: number;
  tone: Tone;
  bits: { dx: number; dy: number; d: number }[];
}

const TONE_TEXT: Record<Tone, string> = { good: "text-ink", bad: "text-brick", gold: "text-gold" };
const TONE_DOT: Record<Tone, string> = { good: "bg-ink", bad: "bg-brick", gold: "bg-gold" };

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface GameEffects {
  spawnFloat: (opts: { xPct: number; bottomPx: number; text: string; tone?: Tone }) => void;
  spawnBurst: (opts: { xPct: number; bottomPx: number; tone?: Tone; count?: number }) => void;
  clear: () => void;
  render: React.ReactNode;
}

export function useGameEffects(): GameEffects {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const seq = useRef(0);

  const spawnFloat = useCallback<GameEffects["spawnFloat"]>(({ xPct, bottomPx, text, tone = "good" }) => {
    const id = seq.current++;
    setFloaters((f) => [...f, { id, text, xPct, bottomPx, tone }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 850);
  }, []);

  const spawnBurst = useCallback<GameEffects["spawnBurst"]>(({ xPct, bottomPx, tone = "good", count = 8 }) => {
    if (reduced()) return; // particles are pure motion — skip when reduced
    const id = seq.current++;
    const bits = Array.from({ length: count }, () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 26;
      return { dx: Math.cos(ang) * dist, dy: Math.sin(ang) * dist, d: Math.random() * 60 };
    });
    setBursts((b) => [...b, { id, xPct, bottomPx, tone, bits }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 650);
  }, []);

  const clear = useCallback(() => {
    setFloaters([]);
    setBursts([]);
  }, []);

  const render = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {bursts.map((b) =>
        b.bits.map((bit, i) => (
          <span
            key={`${b.id}-${i}`}
            className={`ge-bit absolute h-1.5 w-1.5 rounded-full ${TONE_DOT[b.tone]}`}
            style={
              {
                left: `${b.xPct}%`,
                bottom: b.bottomPx,
                ["--dx" as string]: `${bit.dx}px`,
                ["--dy" as string]: `${bit.dy}px`,
                animationDelay: `${bit.d}ms`,
              } as React.CSSProperties
            }
          />
        )),
      )}
      {floaters.map((f) => (
        <span
          key={f.id}
          className={`ge-float absolute -translate-x-1/2 whitespace-nowrap font-mono text-sm font-bold ${TONE_TEXT[f.tone]}`}
          style={{ left: `${f.xPct}%`, bottom: f.bottomPx }}
        >
          {f.text}
        </span>
      ))}
      <style jsx>{`
        .ge-float {
          animation: ge-float 850ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          text-shadow: 0 1px 2px rgba(251, 250, 246, 0.9);
        }
        @keyframes ge-float {
          0% {
            opacity: 0;
            transform: translate(-50%, 6px) scale(0.9);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1.05);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -34px) scale(1);
          }
        }
        .ge-bit {
          animation: ge-bit 620ms ease-out forwards;
        }
        @keyframes ge-bit {
          0% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--dx)), calc(var(--dy) * -1)) scale(0.4);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ge-float {
            animation: none;
            opacity: 1;
          }
          .ge-bit {
            display: none;
          }
        }
      `}</style>
    </div>
  );

  return { spawnFloat, spawnBurst, clear, render };
}
