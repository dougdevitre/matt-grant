// Client-safe pure helpers for the budget builder: dollar formatting, planning
// math (max affordable / line totals / summary), URL validation, the editable
// config (categories + offline seed catalog), and the expense rollup.
//
// No server-only imports — used by both client components and server routes.

import type {
  BudgetSummary,
  ExpenseRequest,
  ExpenseRollup,
  ExpenseStatus,
  Item,
  QtyMap,
} from "./types";
import { EXPENSE_STATUSES } from "./types";

// ── Config (safe for a non-engineer to edit) ──────────────────────────────────
// Categories shown in the planner filter + the propose form. Mirror the
// single-select options on the Airtable Items/Expense Requests tables; `typecast`
// resolves them by name on write.
export const BUDGET_CATEGORIES = [
  "Yard Signs",
  "Wall Décor / Posters",
  "Print Literature",
  "Direct Mail",
  "Apparel",
  "Promo Items",
  "Digital",
  "Events",
  "Software",
  "Other",
] as const;

export const DEFAULT_AVAILABLE_FUNDS = 10000;

// Educational framing shown in the UI. Not legal advice.
export const BUDGET_FEC_NOTE =
  "Planning tool only — not the official FEC disbursement ledger. Record every purchase " +
  "(date, payee, purpose, amount) in your compliance system. Add the required disclaimer " +
  "to printed materials per FEC rules; confirm wording with the treasurer/counsel.";

// Offline fallback catalog if the live Airtable fetch returns nothing. Replace
// est. prices with vendor quotes in Airtable; only the Walgreens 11x14 poster
// ($16.99) is confirmed from the product page.
export const SEED_ITEMS: Item[] = [
  { id: "seed-poster-1114", name: "Adhesive Photo Poster 11x14 (Satin)", category: "Wall Décor / Posters", vendor: "Walgreens Photo", unitPrice: 16.99, unit: "each", productLink: "https://photo.walgreens.com/create/builder?sku=CommerceProduct_27868&category=singlesurface&productCategory=Home%20Decor", sku: "CommerceProduct_27868", minOrderQty: 1 },
  { id: "seed-yardsign", name: "Yard sign 18x24 (coroplast, 2-sided + stake)", category: "Yard Signs", vendor: "Signs.com", unitPrice: 4.25, unit: "each", productLink: "", sku: "", minOrderQty: 25 },
  { id: "seed-banner", name: "Vinyl banner 3x6", category: "Yard Signs", vendor: "Banners.com", unitPrice: 60, unit: "each", productLink: "", sku: "", minOrderQty: 1 },
  { id: "seed-postcard", name: "Postcard mailer 6x9 (print)", category: "Direct Mail", vendor: "PrintingForLess", unitPrice: 0.32, unit: "each", productLink: "", sku: "", minOrderQty: 500 },
  { id: "seed-doorhanger", name: "Door hanger", category: "Print Literature", vendor: "VistaPrint", unitPrice: 0.18, unit: "each", productLink: "", sku: "", minOrderQty: 250 },
  { id: "seed-bumper", name: "Bumper sticker", category: "Promo Items", vendor: "StickerMule", unitPrice: 0.45, unit: "each", productLink: "", sku: "", minOrderQty: 50 },
  { id: "seed-tshirt", name: "Campaign t-shirt", category: "Apparel", vendor: "CustomInk", unitPrice: 8.5, unit: "each", productLink: "", sku: "", minOrderQty: 24 },
  { id: "seed-button", name: "Button / pin 2.25in", category: "Promo Items", vendor: "Busy Beaver", unitPrice: 0.55, unit: "each", productLink: "", sku: "", minOrderQty: 100 },
];

// ── Formatting (dollars; the dashboard's lib/money handles cents elsewhere) ─────
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const USD0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const formatUSD = (n: number): string => USD.format(Number.isFinite(n) ? n : 0);
export const formatUSD0 = (n: number): string => USD0.format(Number.isFinite(n) ? n : 0);

export const toNumber = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** How many of one item the full budget could buy. Guards div-by-zero. */
export const maxAffordable = (available: number, unitPrice: number): number =>
  unitPrice > 0 ? Math.floor(available / unitPrice) : 0;

export const lineTotal = (unitPrice: number, qty: number): number =>
  toNumber(unitPrice) * Math.max(0, toNumber(qty));

export const summarizePlan = (items: Item[], qty: QtyMap, available: number): BudgetSummary => {
  const allocated = items.reduce((sum, it) => sum + lineTotal(it.unitPrice, qty[it.id] ?? 0), 0);
  return {
    available,
    allocated,
    remaining: available - allocated,
    pctAllocated: available > 0 ? (allocated / available) * 100 : 0,
  };
};

export const isValidHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url ?? "");

// ── Expense rollup ────────────────────────────────────────────────────────────
const sumWhere = (rows: ExpenseRequest[], statuses: ExpenseStatus[]): number =>
  rows.reduce((s, r) => (statuses.includes(r.status) ? s + (r.amount || 0) : s), 0);

export const rollupExpenses = (rows: ExpenseRequest[]): ExpenseRollup => {
  const counts = Object.fromEntries(EXPENSE_STATUSES.map((s) => [s, 0])) as Record<ExpenseStatus, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return {
    pending: sumWhere(rows, ["Proposed", "Under Review"]),
    committed: sumWhere(rows, ["Approved"]),
    spent: sumWhere(rows, ["Paid"]),
    counts,
  };
};

/** Paid amount grouped by category, descending. */
export const paidByCategory = (rows: ExpenseRequest[]): { category: string; spent: number }[] => {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "Paid") continue;
    map.set(r.category || "Other", (map.get(r.category || "Other") ?? 0) + (r.amount || 0));
  }
  return [...map.entries()].map(([category, spent]) => ({ category, spent })).sort((a, b) => b.spent - a.spent);
};
