"use client";

// Public donate-page impact picker. Donor picks an amount and sees the concrete
// budget items that contribution funds, pulled live from the Items catalog so the
// page always reflects what the campaign actually buys. The amount also deep-links
// to WinRed (where the real, FEC-compliant transaction happens).
import { useMemo, useState } from "react";
import type { Item } from "@/lib/budget/types";
import { formatUSD, maxAffordable, toNumber } from "@/lib/budget/plan";
import { donateHref } from "@/lib/donorLadder";

const AMOUNTS = [25, 50, 100, 250, 500, 1000];

export default function DonationImpact({
  items,
  donateBase,
}: {
  items: Item[];
  donateBase: string;
}) {
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState<string>("");

  // Show the most relatable, lowest-unit-cost items first so the counts feel
  // tangible ("555 door hangers" reads better than "5 banners"). Cap the list.
  const fundable = useMemo(
    () =>
      [...items]
        .filter((i) => i.unitPrice > 0 && i.name)
        .sort((a, b) => a.unitPrice - b.unitPrice)
        .slice(0, 5),
    [items],
  );

  // Proper URL building (no string concat) + a per-surface source code, so
  // WinRed preselects the amount and its reports attribute the gift to this picker.
  const donateUrl = amount > 0 ? donateHref(donateBase, Math.round(amount * 100), "web-impact") : donateBase;

  const pick = (a: number) => {
    setAmount(a);
    setCustom("");
  };
  const onCustom = (v: string) => {
    setCustom(v);
    const n = toNumber(v);
    if (n > 0) setAmount(n);
  };

  return (
    <div className="card mx-auto mt-12 max-w-2xl p-8 sm:p-10">
      <p className="eyebrow text-slate">Choose an amount</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {AMOUNTS.map((a) => {
          const active = !custom && amount === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => pick(a)}
              aria-pressed={active}
              className={`rounded-sm border py-5 font-display text-2xl font-semibold transition-colors ${
                active
                  ? "border-brick bg-brick text-paper"
                  : "border-line bg-white text-ink hover:border-brick"
              }`}
            >
              ${a}
            </button>
          );
        })}
      </div>

      <label className="mt-3 flex items-center gap-3">
        <span className="eyebrow text-slate whitespace-nowrap">Other $</span>
        <input
          inputMode="decimal"
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          placeholder="Enter an amount"
          className="w-full rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field"
        />
      </label>

      {fundable.length > 0 && amount > 0 && (
        <div className="mt-7 rounded-sm border border-line bg-paper/60 p-5">
          <p className="eyebrow text-brick">Where your {formatUSD(amount)} goes</p>
          <p className="mt-1 text-sm text-slate">
            Your gift helps fund real campaign materials — for example, any one of:
          </p>
          <ul className="mt-4 space-y-2.5">
            {fundable.map((it) => {
              const n = maxAffordable(amount, it.unitPrice);
              if (n < 1) return null;
              return (
                <li key={it.id} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-ink">
                    <span className="font-display text-lg font-semibold text-brick">
                      {n.toLocaleString("en-US")}
                    </span>{" "}
                    {it.name}
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-slate">
                    {formatUSD(it.unitPrice)} {it.unit ? `/ ${it.unit}` : "each"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-slate">
            Illustrative — actual purchases are tracked by the campaign treasurer. Catalog prices
            update live as we get vendor quotes.
          </p>
        </div>
      )}

      <a href={donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6 w-full">
        Donate {amount > 0 ? formatUSD(amount) : "now"} on WinRed →
      </a>
    </div>
  );
}
