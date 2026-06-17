"use client";

import { useEffect, useState } from "react";

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function diff(target: number): Parts {
  const now = Date.now();
  const ms = Math.max(0, target - now);
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

const PAD = (n: number) => String(n).padStart(2, "0");

export function Countdown({
  iso,
  compact = false,
}: {
  iso: string;
  compact?: boolean;
}) {
  const target = new Date(iso).getTime();
  // Start null to keep SSR and first client render identical (no hydration mismatch).
  const [t, setT] = useState<Parts | null>(null);

  useEffect(() => {
    setT(diff(target));
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const cells: [string, number][] = [
    ["Days", t?.days ?? 0],
    ["Hrs", t?.hours ?? 0],
    ["Min", t?.minutes ?? 0],
    ["Sec", t?.seconds ?? 0],
  ];

  return (
    <div className={`flex ${compact ? "gap-2" : "gap-3 sm:gap-4"}`} role="timer" aria-label="Time until election day">
      {cells.map(([label, value], i) => (
        <div
          key={label}
          className={`flex flex-col items-center ${compact ? "min-w-[3rem]" : "min-w-[4.25rem]"}`}
        >
          <span
            className={`font-mono tabular-nums leading-none text-gold ${
              compact ? "text-2xl" : "text-4xl sm:text-5xl"
            }`}
          >
            {label === "Days" ? value : PAD(value)}
          </span>
          <span className="eyebrow mt-2 text-[0.6rem] text-paper/70">{label}</span>
        </div>
      ))}
    </div>
  );
}
