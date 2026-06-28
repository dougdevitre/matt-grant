"use client";

import {
  rotationConfig,
  effectiveness,
  seatStatus,
  type Seat,
} from "@/lib/games/rotation";

// Rotation — the timing visual. The effectiveness curve is drawn as a horizontal
// TRACK. The sweet-spot window [cap-delta, cap] is a highlighted target ZONE; a
// marker representing the seat's current serviceTicks climbs the track in real time
// so the player can SEE it approach → enter → pass the window. Bar fill intensity
// shows effectiveness magnitude. Status is conveyed with icon + text (never color
// alone) and a "Ready" / "Entrenched" callout. Presentation only — every number is
// derived read-only from the locked reducer (effectiveness/seatStatus/rotationConfig).

const { capTicks, windowDelta, peakEffectiveness, grandfatherNaturalTerm } = rotationConfig;

// Track end: cap plus headroom so the player can watch a seat slide PAST the window
// into entrenchment. Clamp so a wildly long-serving seat still pins to the far edge.
const TRACK_END = capTicks + windowDelta * 2;
const TICKS_PER_SEC = 30; // 30 Hz fixed timestep — matches the engine (DEFAULT_DT_MS = 1000/30)

const pct = (ticks: number) => Math.max(0, Math.min(100, (ticks / TRACK_END) * 100));

const STATUS_ICON: Record<string, string> = {
  ramping: "▲", // climbing the ramp
  ready: "◆", // in the window — rotate now
  entrenched: "■", // past the cap — careerism
};

const STATUS_TEXT: Record<string, string> = {
  ramping: "Ramping",
  ready: "Ready — rotate now",
  entrenched: "Entrenched",
};

export function RotationSeatBar({ seat }: { seat: Seat }) {
  const status = seatStatus(seat.serviceTicks, rotationConfig);
  const eff = effectiveness(seat.serviceTicks, rotationConfig);
  const intensity = Math.max(0, Math.min(1, eff / peakEffectiveness)); // 0..1 fill

  const ready = status === "ready";
  const entrenched = status === "entrenched";

  const windowLeft = pct(capTicks - windowDelta);
  const windowRight = pct(capTicks);
  const windowWidth = Math.max(0, windowRight - windowLeft);
  const markerPos = pct(seat.serviceTicks);

  // Grandfathered seats expire on their own — surface a "term ends in Xs" countdown so
  // the player learns to LET THEM EXPIRE rather than spend a rotation.
  const expireSeconds = seat.grandfathered
    ? Math.max(0, (grandfatherNaturalTerm - seat.serviceTicks) / TICKS_PER_SEC)
    : null;

  const fillClass = ready ? "bg-brick" : entrenched ? "bg-slate" : "bg-ink";

  return (
    <div className="mt-2">
      {/* The track. Window zone is a hatched/outlined target; the marker climbs it. */}
      <div
        className="rotation-track relative h-7 w-full overflow-hidden rounded-md border border-line bg-paper"
        aria-hidden="true"
      >
        {/* Effectiveness fill — height/intensity scales with captured value. */}
        <span
          className={`absolute bottom-0 left-0 block h-full ${fillClass} transition-[width] duration-150 ease-out`}
          style={{ width: `${markerPos}%`, opacity: 0.18 + intensity * 0.5 }}
        />
        {/* Sweet-spot target zone. */}
        <span
          className="rotation-zone absolute inset-y-0 block"
          style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }}
        />
        {/* Cap line — past this is entrenchment. */}
        <span className="absolute inset-y-0 w-px bg-brick/60" style={{ left: `${windowRight}%` }} />
        {/* The climbing marker. */}
        <span
          className={`rotation-marker absolute top-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line text-[0.6rem] font-bold leading-none shadow-card ${
            ready ? "bg-brick text-paper" : entrenched ? "bg-slate text-paper" : "bg-paper text-ink"
          }`}
          style={{ left: `${markerPos}%` }}
        >
          {STATUS_ICON[status]}
        </span>
      </div>

      {/* Color-independent status line: icon + text + magnitude. */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.7rem]">
        <span
          className={`inline-flex items-center gap-1 font-semibold ${
            ready ? "text-brick" : entrenched ? "text-slate" : "text-ink"
          }`}
        >
          <span aria-hidden="true">{STATUS_ICON[status]}</span>
          {STATUS_TEXT[status]}
        </span>
        {expireSeconds != null ? (
          <span className="font-mono tabular-nums text-slate">
            ⏳ term ends in {expireSeconds.toFixed(1)}s
          </span>
        ) : (
          <span className="font-mono tabular-nums text-slate">
            {eff.toLocaleString("en-US")} / {peakEffectiveness.toLocaleString("en-US")}
          </span>
        )}
      </div>

      <style jsx>{`
        .rotation-marker {
          transition: left 120ms ease-out;
        }
        .rotation-track .rotation-zone {
          /* gold token (#2563EB) hatch — the sweet-spot target zone */
          background-image: repeating-linear-gradient(
            45deg,
            rgba(37, 99, 235, 0.32) 0,
            rgba(37, 99, 235, 0.32) 2px,
            transparent 2px,
            transparent 6px
          );
          border-left: 1px dashed rgba(37, 99, 235, 0.7);
          border-right: 1px dashed rgba(37, 99, 235, 0.7);
        }
        @media (prefers-reduced-motion: reduce) {
          .rotation-marker {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
