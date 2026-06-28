"use client";

// Climbing debt meter for Cut & Save. Only shown when debt > 0 (borrowing compounds).
// The fill grows with debt and briefly pulses when debt INCREASES — we detect that by
// comparing the incoming value to the previous one held in a ref across renders.
//
// Accessibility: status is carried by an icon + text ("Debt — compounding"), never color
// alone; the pulse is removed under prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";
import { cutSaveConfig } from "@/lib/games/cut-and-save";

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// A soft reference scale so the bar reads as "climbing" without a real ceiling:
// 6 borrows worth of principal (before compounding) fills the bar.
const DEBT_SCALE = Math.max(1, cutSaveConfig.borrow.debtAdded * 6);

export function CutAndSaveDebtMeter({ debt }: { debt: number }) {
  const prevRef = useRef(debt);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (debt > prevRef.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prevRef.current = debt;
      return () => clearTimeout(t);
    }
    prevRef.current = debt;
  }, [debt]);

  if (debt <= 0) return null;

  const fill = Math.max(4, Math.min(100, (debt / DEBT_SCALE) * 100));

  return (
    <div
      className={`debt-meter rounded-lg border border-brick/40 bg-white p-3 shadow-card ${
        pulse ? "is-pulsing" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brick">
          <span aria-hidden="true">⚠</span> Debt — compounding
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-brick">{money(debt)}</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="debt-fill h-full rounded-full bg-brick" style={{ width: `${fill}%` }} />
      </div>

      <style jsx>{`
        .debt-fill {
          transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .debt-meter.is-pulsing {
          animation: debt-pulse 600ms ease-out;
        }
        @keyframes debt-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(181, 52, 59, 0.5);
            background-color: rgba(181, 52, 59, 0.08);
          }
          100% {
            box-shadow: 0 0 0 8px rgba(181, 52, 59, 0);
            background-color: #ffffff;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .debt-fill {
            transition: none;
          }
          .debt-meter.is-pulsing {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
