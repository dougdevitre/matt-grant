"use client";

// Open to finance-visible staff. Always creates a "Proposed" request; an admin
// dispositions it in the Approvals tab. The signed-in staffer's identity is
// attached server-side, so there's no "your name/email" field here.
import { useState } from "react";
import { BUDGET_CATEGORIES, formatUSD, toNumber } from "@/lib/budget/plan";

const input = "rounded-sm border border-line bg-white px-3 py-2 text-sm text-ink focus:border-field";

const EMPTY = { title: "", category: "Other", vendor: "", quoteLink: "", quantity: "", unitPrice: "", purpose: "", neededBy: "" };

export default function ProposeExpense({ onSubmitted }: { onSubmitted?: () => void }) {
  const [f, setF] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const amount = toNumber(f.quantity) * toNumber(f.unitPrice);

  const submit = async () => {
    if (!f.title && !f.vendor) {
      setMsg("Add a title or vendor.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/budget/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: f.title,
          category: f.category,
          vendor: f.vendor,
          quoteLink: f.quoteLink,
          quantity: toNumber(f.quantity),
          unitPrice: toNumber(f.unitPrice),
          amount,
          purpose: f.purpose,
          neededBy: f.neededBy || null,
        }),
      });
      if (!res.ok) throw new Error(`propose ${res.status}`);
      setF({ ...EMPTY });
      setMsg("Submitted for review.");
      onSubmitted?.();
    } catch {
      setMsg("Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input placeholder="Title" value={f.title} onChange={(e) => set("title", e.target.value)} className={`${input} w-full`} />
      <div className="grid grid-cols-2 gap-3">
        <input placeholder="Vendor" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} className={input} />
        <select value={f.category} onChange={(e) => set("category", e.target.value)} className={input} aria-label="Category">
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <input placeholder="Quote / product link (https://)" value={f.quoteLink} onChange={(e) => set("quoteLink", e.target.value)} className={`${input} w-full`} />
      <div className="grid grid-cols-2 gap-3">
        <input inputMode="numeric" placeholder="Quantity" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} className={input} />
        <input inputMode="decimal" placeholder="Unit price $" value={f.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} className={input} />
      </div>
      <textarea placeholder="Purpose / justification" value={f.purpose} onChange={(e) => set("purpose", e.target.value)} className={`${input} min-h-16 w-full`} />
      <label className="flex items-center gap-3 text-sm text-slate">
        Needed by
        <input type="date" value={f.neededBy} onChange={(e) => set("neededBy", e.target.value)} className={input} />
        <span className="ml-auto font-mono text-ink">{formatUSD(amount)}</span>
      </label>
      <button disabled={busy} onClick={submit} className="btn-ink w-full disabled:opacity-50">
        {busy ? "Submitting…" : "Submit for review"}
      </button>
      {msg && <p className="text-sm text-slate">{msg}</p>}
    </div>
  );
}
