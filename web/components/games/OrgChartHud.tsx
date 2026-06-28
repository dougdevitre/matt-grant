"use client";

// HUD for Org Chart: headcount vs. the target band, the service meter, and the round
// timer. Band status and service are conveyed with text + position (never color alone)
// so the display is readable color-blind and by screen readers. The service meter width
// animates, and a brief flash plays when the service level drops — both gated behind
// prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";

export interface OrgChartHudProps {
  headcount: number;
  band: [number, number];
  serviceLevel: number;
  serviceFloor: number;
  secondsLeft: number;
}

export function OrgChartHud({ headcount, band, serviceLevel, serviceFloor, secondsLeft }: OrgChartHudProps) {
  const [min, max] = band;
  const within = headcount >= min && headcount <= max;
  const status = within ? "In band ✓" : headcount > max ? "Too big ↓ cut" : "Too lean ↑";
  const serviceWarn = serviceLevel < serviceFloor + 15;

  // Flash the service meter when the level drops (a cut hit a protected/critical role).
  const prevService = useRef(serviceLevel);
  const [dropping, setDropping] = useState(false);
  useEffect(() => {
    if (serviceLevel < prevService.current) {
      setDropping(true);
      const t = setTimeout(() => setDropping(false), 500);
      prevService.current = serviceLevel;
      return () => clearTimeout(t);
    }
    prevService.current = serviceLevel;
  }, [serviceLevel]);

  return (
    <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-white p-4 shadow-card sm:grid-cols-4" role="status" aria-live="polite">
      <div className="flex flex-col">
        <span className="eyebrow text-slate">Headcount</span>
        <span className="font-mono text-lg font-bold tabular-nums text-ink">{headcount}</span>
      </div>
      <div className="flex flex-col">
        <span className="eyebrow text-slate">Target band</span>
        <span className="font-mono text-lg font-bold tabular-nums text-ink">
          {min}–{max}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="eyebrow text-slate">Status</span>
        <span className={`text-sm font-bold ${within ? "text-ink" : "text-brick"}`}>{status}</span>
      </div>
      <div className="flex flex-col">
        <span className="eyebrow text-slate">Time</span>
        <span className="font-mono text-lg font-bold tabular-nums text-ink">{Math.max(0, Math.ceil(secondsLeft))}s</span>
      </div>
      <div className="col-span-2 sm:col-span-4">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-slate">
            Service level {serviceWarn ? "— at risk" : ""}
            {dropping ? " ↓ lost" : ""}
          </span>
          <span className="font-mono text-xs tabular-nums text-slate">{serviceLevel}/100 (floor {serviceFloor})</span>
        </div>
        <div
          className={`org-service-track mt-1 h-2 w-full overflow-hidden rounded-full bg-line ${
            dropping ? "org-service-flash" : ""
          }`}
          aria-hidden="true"
        >
          <span
            className={`org-service-fill block h-full ${serviceWarn ? "bg-brick" : "bg-ink"}`}
            style={{ width: `${serviceLevel}%` }}
          />
        </div>
      </div>

      <style jsx>{`
        .org-service-fill {
          transition: width 320ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .org-service-flash {
          animation: org-flash 500ms ease-out;
        }
        @keyframes org-flash {
          0% {
            box-shadow: 0 0 0 0 var(--tw-shadow-color, rgba(180, 30, 30, 0.7));
            outline: 2px solid rgba(180, 30, 30, 0.9);
            outline-offset: 1px;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(180, 30, 30, 0);
            outline: 2px solid rgba(180, 30, 30, 0);
            outline-offset: 1px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .org-service-fill {
            transition: none;
          }
          .org-service-flash {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
