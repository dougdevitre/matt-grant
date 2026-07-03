// Tiny inline-SVG sparkline for the KPI tiles. Server-rendered, zero client JS (same
// posture as BarChart) — a normalized polyline + faint area fill + a dot on the last
// point. Decorative (aria-hidden): the StatTile's delta chip carries the accessible
// signal, so the trend line is visual polish layered on top of the number.
import { linScale } from "@/lib/viz/chart";
import { BRAND } from "@/lib/viz/palette";

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = BRAND.field,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  if (data.length < 2) return null; // nothing meaningful to draw
  const pad = 2;
  const x = linScale(0, data.length - 1, pad, width - pad);
  const lo = Math.min(...data);
  const hi = Math.max(...data);
  // Flat series → sit the line on the vertical middle rather than dividing by zero.
  const y = lo === hi
    ? () => height / 2
    : linScale(lo, hi, height - pad, pad); // invert: larger value → higher (smaller y)

  const pts = data.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <polygon points={area} fill={color} opacity={0.1} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}
