// Shared KPI stat tile. Unifies three near-identical local copies that had
// diverged (dashboard/page.tsx, finance/page.tsx, and LedgerStat in BudgetBuilder).
//
//   variant "card"  → the boxed tile (card p-6)         · "bare" → no chrome (sits in a shared card)
//   size    "display" → font-display text-4xl (the KPI) · "ledger" → font-mono text-xl (the budget ledger)
//   accent  → className applied to the number (e.g. "text-brick"); defaults to text-ink
import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  accent,
  variant = "card",
  size = "display",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  variant?: "card" | "bare";
  size?: "display" | "ledger";
}) {
  const numberCls =
    size === "ledger" ? "mt-1 font-mono text-xl font-semibold" : "mt-3 font-display text-4xl font-semibold";
  return (
    <div className={variant === "card" ? "card p-6" : ""}>
      <p className="eyebrow text-slate">{label}</p>
      <p className={`${numberCls} ${accent ?? "text-ink"}`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-slate">{sub}</p>}
    </div>
  );
}
