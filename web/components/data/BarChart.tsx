// Server-rendered inline SVG for the demographic figures. Consumes the pure
// geometry from lib/viz/chart.ts and emits static <rect>/<text>/<line> — no client
// JS, no charting library, no external runtime (keeps the site self-contained and
// ISR-friendly). The SVG is aria-hidden: the accessible text alternative is the
// figure's `alt` sentence plus the always-present data table in <Figure>, so the
// chart is decoration layered on top of an already-complete, WCAG-clean figure.
import { layout, type ChartSpec, type Mark } from "@/lib/viz/chart";

function renderMark(m: Mark, i: number) {
  if (m.t === "rect") {
    return <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={m.rx} fill={m.fill} />;
  }
  if (m.t === "line") {
    return <line key={i} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.stroke} strokeWidth={1} />;
  }
  return (
    <text
      key={i}
      x={m.x}
      y={m.y}
      textAnchor={m.anchor}
      dominantBaseline="middle"
      fill={m.fill}
      fontSize={m.size}
      fontWeight={m.weight}
      fontFamily="inherit"
    >
      {m.s}
    </text>
  );
}

export function BarChart({ spec, labelGutter }: { spec: ChartSpec; labelGutter?: number }) {
  const { width, height, marks } = layout(spec, labelGutter ? { labelGutter } : undefined);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-hidden="true"
      focusable="false"
      className="max-w-full"
      style={{ height: "auto" }}
    >
      {marks.map(renderMark)}
    </svg>
  );
}
