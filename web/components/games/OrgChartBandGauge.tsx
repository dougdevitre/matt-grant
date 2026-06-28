"use client";

// OrgChartBandGauge — a vertical "right-size" scale. The target band [min,max] is drawn
// as a highlighted zone; an animated marker rides the scale at the current headcount.
// Status is read from the marker's POSITION relative to the zone AND a text label +
// glyph (in band / too big / too lean) — never color alone — so it's color-blind and
// screen-reader friendly. The marker transition respects prefers-reduced-motion.

export interface OrgChartBandGaugeProps {
  headcount: number;
  band: [number, number];
}

type Status = "in" | "over" | "under";

export function OrgChartBandGauge({ headcount, band }: OrgChartBandGaugeProps) {
  const [min, max] = band;

  // Scale runs from 0 up to a ceiling that always leaves headroom above the band,
  // so the marker never pins to the very top while you still have cutting to do.
  const ceiling = Math.max(max + Math.ceil((max - min) || 1) * 2, headcount + 2, max + 4);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / ceiling) * 100));

  const bandLow = pct(min);
  const bandHigh = pct(max);
  const markerPct = pct(headcount);

  const status: Status = headcount > max ? "over" : headcount < min ? "under" : "in";
  const statusText = status === "in" ? "In band" : status === "over" ? "Too big" : "Too lean";
  const statusGlyph = status === "in" ? "✓" : status === "over" ? "↓" : "↑";
  const statusHint =
    status === "in" ? "right-sized" : status === "over" ? "cut bloat" : "stop cutting";

  return (
    <div className="card flex gap-4 p-4" aria-hidden="false">
      <div
        className="relative h-44 w-14 shrink-0 rounded-md border border-line bg-paper"
        role="img"
        aria-label={`Headcount ${headcount}. Target band ${min} to ${max}. ${statusText} (${statusHint}).`}
      >
        {/* Target zone */}
        <span
          className="absolute inset-x-0 rounded-sm border-y border-dashed border-ink/40 bg-gold/30"
          style={{ bottom: `${bandLow}%`, height: `${Math.max(2, bandHigh - bandLow)}%` }}
          aria-hidden="true"
        />
        {/* Band edge tick labels */}
        <span
          className="absolute -left-px translate-x-[-100%] pr-1 font-mono text-[10px] tabular-nums text-slate"
          style={{ bottom: `${bandHigh}%`, transform: "translate(-100%, 50%)" }}
          aria-hidden="true"
        >
          {max}
        </span>
        <span
          className="absolute -left-px pr-1 font-mono text-[10px] tabular-nums text-slate"
          style={{ bottom: `${bandLow}%`, transform: "translate(-100%, 50%)" }}
          aria-hidden="true"
        >
          {min}
        </span>
        {/* TARGET label inside the zone */}
        <span
          className="absolute inset-x-0 text-center font-mono text-[8px] font-bold uppercase tracking-wide text-ink/70"
          style={{ bottom: `${(bandLow + bandHigh) / 2}%`, transform: "translateY(50%)" }}
          aria-hidden="true"
        >
          target
        </span>
        {/* Animated marker */}
        <span
          className="org-gauge-marker absolute inset-x-0 flex items-center"
          style={{ bottom: `${markerPct}%`, transform: "translateY(50%)" }}
          aria-hidden="true"
        >
          <span className="h-0.5 w-full bg-ink" />
          <span className="absolute right-full mr-1 font-mono text-[10px] font-bold tabular-nums text-ink">
            ▶
          </span>
        </span>
      </div>

      <div className="flex flex-col justify-center gap-1">
        <span className="eyebrow text-slate">Right-size gauge</span>
        <span className="flex items-center gap-1 text-sm font-bold text-ink">
          <span aria-hidden="true" className="font-mono">
            {statusGlyph}
          </span>
          {statusText}
        </span>
        <span className="font-mono text-xs tabular-nums text-slate">
          {headcount} / band {min}–{max}
        </span>
        <span className="text-xs text-slate">{statusHint}</span>
      </div>

      <style jsx>{`
        .org-gauge-marker {
          transition: bottom 240ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .org-gauge-marker {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
