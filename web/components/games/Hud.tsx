"use client";

// Heads-up display for Cut & Save. Pure presentational — values are passed in from
// the game's current sim state. Numbers carry text labels (never color alone) so the
// HUD is readable color-blind and by screen readers.

export interface HudProps {
  relief: number;
  taxPct: number;
  debt: number;
  streak: number;
  multiplier: number;
  secondsLeft: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="flex flex-col">
      <span className="eyebrow text-slate">{label}</span>
      <span
        className={`font-mono text-lg font-bold tabular-nums ${
          tone === "warn" ? "text-brick" : tone === "good" ? "text-ink" : "text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Hud({ relief, taxPct, debt, streak, multiplier, secondsLeft }: HudProps) {
  return (
    <div
      className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-5"
      role="status"
      aria-live="polite"
    >
      <Stat label="Relief funded" value={money(relief)} tone="good" />
      <Stat label="Tax rate" value={`${Math.round(taxPct)}%`} />
      <Stat label="Debt" value={debt > 0 ? money(debt) : "—"} tone={debt > 0 ? "warn" : undefined} />
      <Stat label="Streak" value={`${streak} ×${multiplier.toFixed(2)}`} />
      <Stat label="Time" value={`${Math.max(0, Math.ceil(secondsLeft))}s`} />
    </div>
  );
}
