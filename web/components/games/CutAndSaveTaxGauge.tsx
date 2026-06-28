"use client";

// Signature visual for Cut & Save: a vertical "tax rate" gauge that smoothly drains
// DOWN as relief grows — the emotional payoff of lowering taxes. Purely presentational;
// it reads taxPct (and the config's tax floor) and animates the fill height via a CSS
// transition. The floor is drawn as a marked zone + line so the player can see the goal.
//
// Accessibility: the gauge is mirrored by text + an icon (never color alone), exposes a
// progressbar role with aria values, and all motion is disabled under prefers-reduced-motion.

import { cutSaveConfig } from "@/lib/games/cut-and-save";

const TAX_FLOOR = cutSaveConfig.taxFloor; // e.g. 12 — the lowest taxes can go

export function CutAndSaveTaxGauge({ taxPct }: { taxPct: number }) {
  const pct = Math.max(0, Math.min(100, taxPct));
  const rounded = Math.round(pct);
  const atFloor = rounded <= Math.ceil(TAX_FLOOR);
  // Floor zone height as a share of the gauge (0–100% from the bottom).
  const floorZone = Math.max(0, Math.min(100, TAX_FLOOR));

  return (
    <div
      className="flex items-stretch gap-4 rounded-lg border border-line bg-white p-4 shadow-card"
      role="progressbar"
      aria-label="Tax rate"
      aria-valuemin={Math.round(TAX_FLOOR)}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-valuetext={`Tax rate ${rounded} percent${atFloor ? " — at the floor" : ""}`}
    >
      {/* Gauge column */}
      <div className="relative w-16 shrink-0 sm:w-20">
        <div className="relative h-44 w-full overflow-hidden rounded-md border border-line bg-paper sm:h-52">
          {/* Floor zone: a marked band at the bottom the rate is driven toward */}
          <div
            className="absolute inset-x-0 bottom-0 bg-goldlight/50"
            style={{ height: `${floorZone}%` }}
            aria-hidden="true"
          />
          {/* Floor line */}
          <div
            className="absolute inset-x-0 border-t border-dashed border-gold"
            style={{ bottom: `${floorZone}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-3 right-0.5 bg-white/80 px-0.5 font-mono text-[0.55rem] leading-none text-slate">
              floor {Math.round(TAX_FLOOR)}%
            </span>
          </div>
          {/* The draining fill: tall when taxes are high, short when low. */}
          <div
            className={`tax-fill absolute inset-x-0 bottom-0 ${atFloor ? "bg-ink" : "bg-brick"}`}
            style={{ height: `${pct}%` }}
            aria-hidden="true"
          >
            {/* top edge marker line */}
            <span className="absolute inset-x-0 top-0 h-0.5 bg-ink/30" />
          </div>
        </div>
      </div>

      {/* Readout */}
      <div className="flex min-w-0 flex-col justify-center">
        <span className="eyebrow text-slate">Tax rate</span>
        <span className="tax-num flex items-baseline gap-1 font-mono text-3xl font-bold tabular-nums text-ink sm:text-4xl">
          {rounded}
          <span className="text-lg text-slate">%</span>
        </span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate">
          {atFloor ? (
            <>
              <span aria-hidden="true">✓</span> At the tax floor
            </>
          ) : (
            <>
              <span aria-hidden="true">▼</span> Cut waste to lower it
            </>
          )}
        </span>
      </div>

      <style jsx>{`
        .tax-fill {
          transition: height 600ms cubic-bezier(0.22, 1, 0.36, 1),
            background-color 300ms ease;
        }
        .tax-num {
          transition: color 300ms ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .tax-fill,
          .tax-num {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
