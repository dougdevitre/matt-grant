// Shared KPI stat tile. Unifies three near-identical local copies that had
// diverged (dashboard/page.tsx, finance/page.tsx, and LedgerStat in BudgetBuilder).
//
//   variant "card"  → the boxed tile (card p-6)         · "bare" → no chrome (sits in a shared card)
//   size    "display" → font-display text-4xl (the KPI) · "ledger" → font-mono text-xl (the budget ledger)
//   accent  → className applied to the number (e.g. "text-brick"); defaults to text-ink
//   delta   → optional trend chip (▲/▼ + label, colored by tone)  · spark → optional sparkline series
import type { ReactNode } from "react";
import { Sparkline } from "./Sparkline";
import { BRAND } from "@/lib/viz/palette";
import type { DeltaChip } from "@/lib/trends";

const TONE: Record<DeltaChip["tone"], string> = {
  good: "text-field",
  bad: "text-brick",
  neutral: "text-slate",
};
const ARROW: Record<DeltaChip["dir"], string> = { up: "▲", down: "▼", flat: "→" };

export function StatTile({
  label,
  value,
  sub,
  accent,
  variant = "card",
  size = "display",
  delta,
  spark,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  variant?: "card" | "bare";
  size?: "display" | "ledger";
  delta?: DeltaChip;
  spark?: number[];
}) {
  const numberCls =
    size === "ledger" ? "mt-1 font-mono text-xl font-semibold" : "mt-3 font-display text-4xl font-semibold";
  return (
    <div className={variant === "card" ? "card p-6" : ""}>
      <p className="eyebrow text-slate">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className={`${numberCls} ${accent ?? "text-ink"}`}>{value}</p>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={delta?.tone === "bad" ? BRAND.brick : undefined} className="mb-1 shrink-0" />
        )}
      </div>
      {delta && (
        <p className={`mt-2 flex items-center gap-1 font-mono text-xs ${TONE[delta.tone]}`}>
          <span aria-hidden="true">{ARROW[delta.dir]}</span>
          {delta.label}
        </p>
      )}
      {sub && <p className="mt-2 text-xs text-slate">{sub}</p>}
    </div>
  );
}
