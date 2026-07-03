// Accessible progress bar. Replaces the bare `<div style={{width}}>` bars that
// conveyed magnitude through width/color alone (no role, no aria) — screen-reader
// users got nothing. Mirrors the game gauges' contract: role="progressbar" +
// aria-value*, an aria-hidden fill, and reduced-motion handling. Pure/no hooks, so
// it works in both server and client components.
//
// Colors are unchanged: the caller passes the existing color class as fillClassName.
import { meterAria, type MeterInput } from "./meterAria";

export { meterAria } from "./meterAria";

export function Meter({
  value,
  max = 100,
  label,
  valueText,
  fillClassName = "bg-field",
  trackClassName = "h-2 w-full overflow-hidden rounded-full bg-line",
}: MeterInput & { fillClassName?: string; trackClassName?: string }) {
  const { width, attrs } = meterAria({ value, max, label, valueText });
  return (
    <div {...attrs} className={trackClassName}>
      <div
        aria-hidden
        className={`h-full transition-all motion-reduce:transition-none ${fillClassName}`}
        style={{ width }}
      />
    </div>
  );
}
