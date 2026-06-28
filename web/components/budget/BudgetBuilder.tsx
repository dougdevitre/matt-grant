"use client";

// "Plan a purchase" — reads the live Items catalog from /api/budget/items and
// shows, for a given budget, how many of each item the campaign can afford plus a
// running allocation ledger. Planning sandbox only (not the authoritative spend).
import { useEffect, useMemo, useState } from "react";
import type { Item, QtyMap } from "@/lib/budget/types";
import {
  BUDGET_CATEGORIES,
  BUDGET_FEC_NOTE,
  DEFAULT_AVAILABLE_FUNDS,
  SEED_ITEMS,
  formatUSD,
  formatUSD0,
  isValidHttpUrl,
  lineTotal,
  maxAffordable,
  summarizePlan,
  toNumber,
} from "@/lib/budget/plan";

const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

export default function BudgetBuilder() {
  const [items, setItems] = useState<Item[]>(SEED_ITEMS);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState<number>(DEFAULT_AVAILABLE_FUNDS);
  const [qty, setQty] = useState<QtyMap>({});
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    let active = true;
    fetch("/api/budget/items")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { items: Item[]; live: boolean }) => {
        if (!active) return;
        setItems(Array.isArray(d.items) && d.items.length ? d.items : SEED_ITEMS);
        setLive(Boolean(d.live));
      })
      .catch(() => {
        if (active) setLive(false);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () => (category ? items.filter((i) => i.category === category) : items),
    [items, category],
  );
  const summary = useMemo(() => summarizePlan(items, qty, funds), [items, qty, funds]);
  const setItemQty = (id: string, q: number) => setQty((p) => ({ ...p, [id]: Math.max(0, q) }));

  const exportCsv = () => {
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Item Name", "Category", "Vendor", "Unit Price", "Unit", "Product Link", "Quantity", "Line Total"];
    const lines = [head.join(",")];
    for (const it of items) {
      const q = qty[it.id] ?? 0;
      lines.push([it.name, it.category, it.vendor, it.unitPrice.toFixed(2), it.unit, it.productLink, q, lineTotal(it.unitPrice, q).toFixed(2)].map(cell).join(","));
    }
    lines.push("", `${cell("Available funds")},${funds.toFixed(2)}`, `${cell("Allocated")},${summary.allocated.toFixed(2)}`, `${cell("Remaining")},${summary.remaining.toFixed(2)}`);
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "matt-grant-budget-plan.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const over = summary.remaining < 0;
  const tight = !over && summary.pctAllocated >= 90;
  const pct = Math.min(summary.pctAllocated, 100);

  return (
    <div className="space-y-5">
      {!live && (
        <div role="status" className="rounded-sm border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-ink">
          Showing the offline seed catalog — couldn’t reach Airtable. Prices may be out of date.
        </div>
      )}
      <p className="rounded-sm border border-line bg-paper/60 px-4 py-3 text-xs text-slate">{BUDGET_FEC_NOTE}</p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="eyebrow text-slate">Available funds</span>
          <input
            inputMode="decimal"
            value={funds}
            onChange={(e) => setFunds(toNumber(e.target.value))}
            className={`${input} w-44 font-mono`}
            aria-label="Available funds"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow text-slate">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={input} aria-label="Filter by category">
            <option value="">All categories</option>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <span className="flex-1" />
        <button onClick={exportCsv} className="btn-ghost">
          Export CSV
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <p className="p-8 text-center text-slate">Loading catalog…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 eyebrow text-slate">Item</th>
                <th className="px-4 py-3 eyebrow text-slate">Vendor</th>
                <th className="px-4 py-3 eyebrow text-slate text-right">Unit</th>
                <th className="px-4 py-3 eyebrow text-slate text-right">Max</th>
                <th className="px-4 py-3 eyebrow text-slate text-right">Qty</th>
                <th className="px-4 py-3 eyebrow text-slate text-right">Line total</th>
                <th className="px-4 py-3 eyebrow text-slate text-center">Buy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((it) => {
                const q = qty[it.id] ?? 0;
                const lt = lineTotal(it.unitPrice, q);
                return (
                  <tr key={it.id} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{it.name}</p>
                      <p className="text-xs text-slate">{it.category}</p>
                    </td>
                    <td className="px-4 py-3 text-slate">{it.vendor}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink">{formatUSD(it.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate">
                      {maxAffordable(funds, it.unitPrice).toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        inputMode="numeric"
                        value={q}
                        onChange={(e) => setItemQty(it.id, toNumber(e.target.value))}
                        className={`${input} w-20 text-right font-mono`}
                        aria-label={`Quantity for ${it.name}`}
                      />
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${lt === 0 ? "text-slate" : "text-ink"}`}>
                      {formatUSD(lt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isValidHttpUrl(it.productLink) ? (
                        <a href={it.productLink} target="_blank" rel="noopener noreferrer" className="font-mono text-xs uppercase tracking-eyebrow text-field underline">
                          Buy ↗
                        </a>
                      ) : (
                        <span className="font-mono text-xs uppercase tracking-eyebrow text-slate/50">Buy ↗</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card flex flex-wrap items-center gap-x-10 gap-y-4 p-5">
        <LedgerStat label="Available" value={formatUSD0(summary.available)} />
        <LedgerStat label="Allocated" value={formatUSD0(summary.allocated)} />
        <LedgerStat
          label="Remaining"
          value={formatUSD0(summary.remaining)}
          accent={over ? "text-brick" : tight ? "text-[#9a6f1a]" : "text-field"}
        />
        <div className="min-w-48 flex-1">
          <p className="mb-1.5 text-xs text-slate">{Math.round(summary.pctAllocated)}% of funds allocated</p>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className={`h-full ${over ? "bg-brick" : tight ? "bg-gold" : "bg-field"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="eyebrow text-slate">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold ${accent ?? "text-ink"}`}>{value}</p>
    </div>
  );
}
