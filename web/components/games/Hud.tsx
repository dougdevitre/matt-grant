"use client";

// Heads-up display for Cut & Save. Pure presentational — values are passed in from
// the game's current sim state. Numbers carry text labels (never color alone) so the
// HUD is readable color-blind and by screen readers.

import { useEffect, useRef, useState } from "react";
import { CutAndSaveCountUp } from "./CutAndSaveCountUp";

export interface HudProps {
  relief: number;
  taxPct: number;
  debt: number;
  streak: number;
  multiplier: number;
  secondsLeft: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function Stat({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value?: string;
  tone?: "good" | "warn";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <span className="eyebrow text-slate">{label}</span>
      <span
        className={`font-mono text-lg font-bold tabular-nums ${
          tone === "warn" ? "text-brick" : "text-ink"
        }`}
      >
        {children ?? value}
      </span>
    </div>
  );
}

export function Hud({ relief, taxPct, debt, streak, multiplier, secondsLeft }: HudProps) {
  // Detect a multiplier step-up for a brief flourish on the streak figure.
  const prevMult = useRef(multiplier);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (multiplier > prevMult.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 500);
      prevMult.current = multiplier;
      return () => clearTimeout(t);
    }
    prevMult.current = multiplier;
  }, [multiplier]);

  return (
    <div
      className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-5"
      role="status"
      aria-live="polite"
    >
      <Stat label="Relief funded" tone="good">
        <CutAndSaveCountUp value={relief} format={money} />
      </Stat>
      <Stat label="Tax rate" value={`${Math.round(taxPct)}%`} />
      <Stat label="Debt" value={debt > 0 ? money(debt) : "—"} tone={debt > 0 ? "warn" : undefined} />
      <Stat label="Streak">
        <span className={`mult-figure inline-block ${bump ? "is-bump" : ""}`}>
          {streak} ×{multiplier.toFixed(2)}
        </span>
      </Stat>
      <Stat label="Time" value={`${Math.max(0, Math.ceil(secondsLeft))}s`} />

      <style jsx>{`
        .mult-figure {
          transition: color 200ms ease;
        }
        .mult-figure.is-bump {
          animation: mult-bump 500ms ease-out;
          color: #2563eb;
        }
        @keyframes mult-bump {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.18);
          }
          100% {
            transform: scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mult-figure.is-bump {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
