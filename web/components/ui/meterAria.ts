// Pure meter math, split out of Meter.tsx so it's unit-testable without pulling
// JSX through the test transform. Clamps to [0,max] and derives the width + the
// ARIA progressbar attributes.
export type MeterInput = { value: number; max?: number; label: string; valueText?: string };

export function meterAria({ value, max = 100, label, valueText }: MeterInput) {
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max > 0 ? (clamped / max) * 100 : 0;
  return {
    width: `${pct}%`,
    attrs: {
      role: "progressbar" as const,
      "aria-label": label,
      "aria-valuemin": 0,
      "aria-valuemax": max,
      "aria-valuenow": Math.round(clamped),
      "aria-valuetext": valueText ?? `${Math.round(pct)}%`,
    },
  };
}
