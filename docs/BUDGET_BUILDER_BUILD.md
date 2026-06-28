# BUDGET_BUILDER_BUILD.md

Agent build spec — adds a **Campaign Expense Budget Builder** feature to the
`matt-grant` repo, mirroring the existing `captain-toolkit` pattern.

> **For the building agent (e.g. Claude Code):** create the files below exactly.
> Mirror existing conventions in `src/features/captain-toolkit/` (imports, lint, path
> aliases). **If a value is unknown, do NOT invent it** — leave the placeholder and the
> `// TODO:` comment. Do not hardcode any Airtable token. Do not expose any token to the
> client bundle. Prices and links in `config.ts` are *seed/fallback* data only.

---

## 1. Goals

- Read the `Items` catalog from Airtable and show, for a given budget, how many of each
  item the campaign can afford, plus an allocation plan with a running ledger.
- Keep the Airtable Personal Access Token server-side (SSM SecureString).
- Let a non-engineer change base/table IDs, categories, and the fallback catalog in `config.ts`.
- Export the plan to CSV/JSON to keep in sync with FEC-compliant expenditure records.

## 2. Non-goals

- Not a payment processor — `Product Link` hands off to the vendor's own checkout.
- Not the official FEC disbursement ledger (this is planning data).
- No client-side Airtable writes. Saving a plan back to Airtable is a later, auth-gated phase.

## 3. User stories

- As **campaign staff**, I set available funds and instantly see how many signs/posters/etc. that buys.
- As **staff**, I build an order plan and watch Remaining update so I don't overspend.
- As a **volunteer captain**, I click **Buy** to open the exact vendor product page.
- As a **non-engineer**, I edit base/table IDs and the seed catalog in one file.
- As a **compliance lead**, I trust the tool never claims to be the filed-expenditure record.

## 4. Assumptions (labeled)

- **ASSUMPTION:** React + Vite + TypeScript frontend; AWS Lambda (or Next.js route) backend — same as `captain-toolkit`.
- **ASSUMPTION:** Airtable base `appiuSYCexFUmGIOr`, table `Items` (`tblehIxTL9TLTTQ0e`) already exist.
- **ASSUMPTION:** Airtable PAT stored in SSM SecureString; param name + base id come from env.
- **ASSUMPTION:** Seed prices in `config.ts` are placeholders except the Walgreens 11x14 poster ($16.99); replace with vendor quotes.
- **ASSUMPTION:** Federal FEC framework governs (U.S. House primary). State/local rules out of scope until compliance confirms.

## 5. File tree

```
src/features/budget-builder/
  config.ts
  types.ts
  money.ts
  api.ts
  useBudget.ts
  BudgetBuilder.tsx
server/budget/
  items.ts
  iam-budget.json
.env.example          # append the budget vars
```

## 6. Data model

`Item` mirrors the Airtable `Items` table:

| Field | Type | Airtable field |
|---|---|---|
| id | string | record id |
| name | string | Item Name |
| category | string | Category |
| vendor | string | Vendor |
| unitPrice | number | Unit Price |
| unit | string | Unit |
| productLink | string | Product Link |
| sku | string | SKU |
| minOrderQty | number | Min Order Qty |

Derived (computed client-side, never stored): `maxAffordable`, `lineTotal`, and the
summary `{ available, allocated, remaining, pctAllocated }`.

## 7. API routes

- `GET /api/budget/items` — `{ items: Item[] }`. Server reads the Airtable PAT from SSM,
  fetches the `Items` table, maps + sanitizes, caches ~60s. Read-only.
- *(Phase 2, not in this build)* `POST /api/budget/plans` — save a plan; Clerk-auth + role check.

## 8. Security

- PAT in **SSM SecureString** only; resolved server-side via AWS SDK v3 with `WithDecryption: true`.
- IAM is least-privilege: `ssm:GetParameter` on the single param ARN (see `iam-budget.json`).
- Client calls only `/api/budget/items`; the token is never in the bundle or in any response.
- Product links render with `target="_blank" rel="noopener noreferrer"` and are scheme-validated (`http`/`https` only).
- Server returns only catalog fields the UI needs; no internal Airtable metadata.

## 9. Edge cases

- Airtable down / 401 → server returns `502` with `{ error }`; client falls back to `config.ts` seed and shows a banner.
- `unitPrice <= 0` → `maxAffordable = 0`, never `Infinity`.
- Negative/blank qty coerced to `0`.
- Available funds blank → treated as `0`; ledger shows 0% and no NaN.
- Allocated > available → Remaining renders negative, ledger turns red.

## 10. Test plan

- `money.test.ts`: `maxAffordable(100, 16.99) === 5`; `lineTotal` and `summarize` math; div-by-zero guard.
- `api.test.ts`: falls back to seed when fetch rejects; maps Airtable fields correctly.
- Component: funds change updates every Max-affordable cell; qty change updates Line total + ledger; Buy link disabled when no/invalid URL.
- Server: missing SSM param → 502, not a crash; PAT never appears in response body.

## 11. Rollout plan

1. Ship behind a `/budget` route (or a tab) visible to staff only.
2. Seed `config.ts` works with zero backend (offline demo).
3. Wire `GET /api/budget/items` once the SSM param + IAM are deployed.
4. Replace seed prices with real vendor quotes in Airtable.
5. Phase 2: auth-gated plan-save back to `Print & Order Plan`.

---

## 12. Files

### `src/features/budget-builder/config.ts`

```ts
// EDIT HERE. Non-engineers can safely change values in this file.
// No secrets here — the Airtable token lives in SSM, read by the server.

export const BUDGET_CONFIG = {
  // Source of truth for the live catalog (used by the server route).
  airtable: {
    baseId: "appiuSYCexFUmGIOr",
    itemsTableId: "tblehIxTL9TLTTQ0e",
  },

  defaultAvailableFunds: 10000,

  categories: [
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
  ] as const,

  // Educational framing shown in the UI. Not legal advice.
  fecNote:
    "Planning tool only — not the official FEC disbursement ledger. Record every purchase " +
    "(date, payee, purpose, amount) in your compliance system. Add the required disclaimer " +
    "to printed materials per FEC rules; confirm wording with the treasurer/counsel.",

  // Fallback catalog if the live Airtable fetch fails. Replace est. prices with quotes.
  // Only the Walgreens 11x14 poster price ($16.99) is confirmed from the product page.
  seedItems: [
    { id: "seed-poster-1114", name: "Adhesive Photo Poster 11x14 (Satin)", category: "Wall Décor / Posters", vendor: "Walgreens Photo", unitPrice: 16.99, unit: "each", productLink: "https://photo.walgreens.com/create/builder?sku=CommerceProduct_27868&category=singlesurface&productCategory=Home%20Decor", sku: "CommerceProduct_27868", minOrderQty: 1 },
    { id: "seed-yardsign", name: "Yard sign 18x24 (coroplast, 2-sided + stake)", category: "Yard Signs", vendor: "Signs.com", unitPrice: 4.25, unit: "each", productLink: "", sku: "", minOrderQty: 25 },
    { id: "seed-banner", name: "Vinyl banner 3x6", category: "Yard Signs", vendor: "Banners.com", unitPrice: 60, unit: "each", productLink: "", sku: "", minOrderQty: 1 },
    { id: "seed-postcard", name: "Postcard mailer 6x9 (print)", category: "Direct Mail", vendor: "PrintingForLess", unitPrice: 0.32, unit: "each", productLink: "", sku: "", minOrderQty: 500 },
    { id: "seed-doorhanger", name: "Door hanger", category: "Print Literature", vendor: "VistaPrint", unitPrice: 0.18, unit: "each", productLink: "", sku: "", minOrderQty: 250 },
    { id: "seed-bumper", name: "Bumper sticker", category: "Promo Items", vendor: "StickerMule", unitPrice: 0.45, unit: "each", productLink: "", sku: "", minOrderQty: 50 },
    { id: "seed-tshirt", name: "Campaign t-shirt", category: "Apparel", vendor: "CustomInk", unitPrice: 8.5, unit: "each", productLink: "", sku: "", minOrderQty: 24 },
    { id: "seed-button", name: "Button / pin 2.25in", category: "Promo Items", vendor: "Busy Beaver", unitPrice: 0.55, unit: "each", productLink: "", sku: "", minOrderQty: 100 },
  ],
} as const;

export type Category = (typeof BUDGET_CONFIG.categories)[number];
```

### `src/features/budget-builder/types.ts`

```ts
export interface Item {
  id: string;
  name: string;
  category: string;
  vendor: string;
  unitPrice: number;
  unit: string;
  productLink: string;
  sku: string;
  minOrderQty: number;
}

export interface BudgetSummary {
  available: number;
  allocated: number;
  remaining: number;
  pctAllocated: number; // 0..100+
}

/** Map of item id -> quantity to buy. */
export type QtyMap = Record<string, number>;
```

### `src/features/budget-builder/money.ts`

```ts
import type { Item, BudgetSummary, QtyMap } from "./types";

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

export const summarize = (items: Item[], qty: QtyMap, available: number): BudgetSummary => {
  const allocated = items.reduce((sum, it) => sum + lineTotal(it.unitPrice, qty[it.id] ?? 0), 0);
  return {
    available,
    allocated,
    remaining: available - allocated,
    pctAllocated: available > 0 ? (allocated / available) * 100 : 0,
  };
};

export const isValidHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url ?? "");
```

### `src/features/budget-builder/api.ts`

```ts
import type { Item } from "./types";
import { BUDGET_CONFIG } from "./config";

interface ItemsResponse { items: Item[] }

/**
 * Loads the live catalog from the server route. The server holds the Airtable
 * token (SSM); the client never sees it. Falls back to the seed catalog so the
 * tool still works offline / during an outage.
 */
export async function fetchItems(signal?: AbortSignal): Promise<{ items: Item[]; live: boolean }> {
  try {
    const res = await fetch("/api/budget/items", { signal });
    if (!res.ok) throw new Error(`items ${res.status}`);
    const data = (await res.json()) as ItemsResponse;
    if (!Array.isArray(data.items)) throw new Error("bad shape");
    return { items: data.items, live: true };
  } catch {
    return { items: BUDGET_CONFIG.seedItems as unknown as Item[], live: false };
  }
}
```

### `src/features/budget-builder/useBudget.ts`

```ts
import { useEffect, useMemo, useState } from "react";
import type { Item, QtyMap } from "./types";
import { BUDGET_CONFIG } from "./config";
import { fetchItems } from "./api";
import { summarize, lineTotal } from "./money";

export function useBudget() {
  const [items, setItems] = useState<Item[]>([]);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState<number>(BUDGET_CONFIG.defaultAvailableFunds);
  const [qty, setQty] = useState<QtyMap>({});
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    const ctrl = new AbortController();
    fetchItems(ctrl.signal).then(({ items, live }) => {
      setItems(items);
      setLive(live);
      setLoading(false);
    });
    return () => ctrl.abort();
  }, []);

  const visible = useMemo(
    () => (category ? items.filter((i) => i.category === category) : items),
    [items, category]
  );

  const summary = useMemo(() => summarize(items, qty, funds), [items, qty, funds]);

  const setItemQty = (id: string, q: number) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, q) }));

  const toCsv = (): string => {
    const head = ["Item Name", "Category", "Vendor", "Unit Price", "Unit", "Product Link", "Quantity", "Line Total"];
    const cell = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [head.join(",")];
    for (const it of items) {
      const q = qty[it.id] ?? 0;
      lines.push([it.name, it.category, it.vendor, it.unitPrice.toFixed(2), it.unit, it.productLink, q, lineTotal(it.unitPrice, q).toFixed(2)].map(cell).join(","));
    }
    lines.push("", `${cell("Available funds")},${funds.toFixed(2)}`, `${cell("Allocated")},${summary.allocated.toFixed(2)}`, `${cell("Remaining")},${summary.remaining.toFixed(2)}`);
    return lines.join("\n");
  };

  return { items, visible, live, loading, funds, setFunds, qty, setItemQty, category, setCategory, summary, toCsv };
}
```

### `src/features/budget-builder/BudgetBuilder.tsx`

```tsx
import React from "react";
import { BUDGET_CONFIG } from "./config";
import { useBudget } from "./useBudget";
import { formatUSD, formatUSD0, maxAffordable, lineTotal, isValidHttpUrl, toNumber } from "./money";

export default function BudgetBuilder() {
  const b = useBudget();

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const pct = Math.min(b.summary.pctAllocated, 100);
  const over = b.summary.remaining < 0;
  const tight = !over && b.summary.pctAllocated >= 90;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif", paddingBottom: 120 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Campaign Expense Budget Builder</h2>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>MO-02 · Primary 08/04/2026</p>
      </header>

      {!b.live && (
        <div role="status" style={banner}>
          Showing the offline seed catalog — couldn't reach Airtable. Prices may be out of date.
        </div>
      )}
      <div style={{ ...banner, background: "#FFF7E8", borderColor: "#ECD9A8", color: "#6B521C" }}>
        {BUDGET_CONFIG.fecNote}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", margin: "16px 0" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#43566B" }}>
          AVAILABLE FUNDS
          <input
            inputMode="decimal"
            value={b.funds}
            onChange={(e) => b.setFunds(toNumber(e.target.value))}
            style={{ fontFamily: "monospace", fontSize: 18, padding: "8px 10px", width: 170, border: "1px solid #cbd5e1", borderRadius: 8 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#43566B" }}>
          CATEGORY
          <select value={b.category} onChange={(e) => b.setCategory(e.target.value)} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
            <option value="">All categories</option>
            {BUDGET_CONFIG.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button onClick={() => download("matt-grant-budget-plan.csv", b.toCsv(), "text/csv")} style={btn}>Export CSV</button>
      </div>

      {b.loading ? <p>Loading catalog…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>
              <th style={th}>Item</th><th style={th}>Category</th><th style={th}>Vendor</th>
              <th style={thR}>Unit price</th><th style={thR}>Max affordable</th>
              <th style={thR}>Qty</th><th style={thR}>Line total</th><th style={thC}>Buy</th>
            </tr>
          </thead>
          <tbody>
            {b.visible.map((it) => {
              const q = b.qty[it.id] ?? 0;
              const lt = lineTotal(it.unitPrice, q);
              return (
                <tr key={it.id} style={{ borderTop: "1px solid #eef0f3" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{it.name}</td>
                  <td style={td}>{it.category}</td>
                  <td style={td}>{it.vendor}</td>
                  <td style={tdR}>{formatUSD(it.unitPrice)}</td>
                  <td style={{ ...tdR, fontFamily: "monospace" }}>{maxAffordable(b.funds, it.unitPrice).toLocaleString("en-US")}</td>
                  <td style={tdR}>
                    <input inputMode="numeric" value={q} onChange={(e) => b.setItemQty(it.id, toNumber(e.target.value))}
                      style={{ width: 70, textAlign: "right", fontFamily: "monospace", padding: "5px 7px", border: "1px solid #cbd5e1", borderRadius: 6 }} />
                  </td>
                  <td style={{ ...tdR, fontFamily: "monospace", fontWeight: 600, color: lt === 0 ? "#b6bdc7" : "#16202e" }}>{formatUSD(lt)}</td>
                  <td style={tdC}>
                    {isValidHttpUrl(it.productLink)
                      ? <a href={it.productLink} target="_blank" rel="noopener noreferrer" style={buyLink}>Buy ↗</a>
                      : <span style={{ ...buyLink, color: "#b6bdc7", borderColor: "#e5e7eb" }}>Buy ↗</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "#16304D", color: "#fff", padding: "14px 24px", display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
        <Stat k="Available" v={formatUSD0(b.summary.available)} />
        <Stat k="Allocated" v={formatUSD0(b.summary.allocated)} />
        <Stat k="Remaining" v={formatUSD0(b.summary.remaining)} color={over ? "#F3A6A0" : tight ? "#F2CE7E" : "#7FE0AB"} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11.5, color: "#B9C6D6", marginBottom: 6 }}>{Math.round(b.summary.pctAllocated)}% of funds allocated</div>
          <div style={{ height: 12, background: "rgba(255,255,255,.12)", borderRadius: 999 }}>
            <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: over ? "#D85A4C" : tight ? "#E0B85A" : "#46C088" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "#93A6BC" }}>{k}</span>
      <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 600, color: color ?? "#fff" }}>{v}</span>
    </div>
  );
}

const banner: React.CSSProperties = { border: "1px solid #d7dee6", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 10 };
const btn: React.CSSProperties = { fontWeight: 600, fontSize: 13, padding: "10px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#21436B", cursor: "pointer" };
const th: React.CSSProperties = { padding: "10px 10px" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const thC: React.CSSProperties = { ...th, textAlign: "center" };
const td: React.CSSProperties = { padding: "9px 10px" };
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
const tdC: React.CSSProperties = { ...td, textAlign: "center" };
const buyLink: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "#21436B", textDecoration: "none", border: "1px solid #cbd5e1", borderRadius: 7, padding: "5px 10px" };
```

### `server/budget/items.ts`

```ts
// AWS SDK v3. Reads the Airtable PAT from SSM SecureString, fetches the Items table,
// returns a sanitized catalog. Token never leaves the server. Adapt the handler
// signature to your runtime (API Gateway HTTP API shown; swap for a Next.js route).

import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const PARAM_NAME = process.env.AIRTABLE_PAT_PARAM!;       // e.g. /matt-grant/airtable/pat
const BASE_ID = process.env.AIRTABLE_BASE_ID!;            // appiuSYCexFUmGIOr
const TABLE_ID = process.env.AIRTABLE_ITEMS_TABLE ?? "tblehIxTL9TLTTQ0e";

let cachedToken: string | null = null;
let cache: { at: number; body: string } | null = null;
const TTL_MS = 60_000;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const out = await ssm.send(new GetParameterCommand({ Name: PARAM_NAME, WithDecryption: true }));
  const v = out.Parameter?.Value;
  if (!v) throw new Error("Airtable PAT not found in SSM");
  cachedToken = v;
  return v;
}

interface AirtableRecord { id: string; fields: Record<string, unknown> }

function mapItem(r: AirtableRecord) {
  const f = r.fields;
  return {
    id: r.id,
    name: String(f["Item Name"] ?? ""),
    category: String(f["Category"] ?? ""),
    vendor: String(f["Vendor"] ?? ""),
    unitPrice: Number(f["Unit Price"] ?? 0),
    unit: String(f["Unit"] ?? ""),
    productLink: String(f["Product Link"] ?? ""),
    sku: String(f["SKU"] ?? ""),
    minOrderQty: Number(f["Min Order Qty"] ?? 0),
  };
}

export async function handler() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return { statusCode: 200, headers: json(), body: cache.body };
    }
    const token = await getToken();
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { statusCode: 502, headers: json(), body: JSON.stringify({ error: "airtable_unavailable" }) };
    const data = (await res.json()) as { records: AirtableRecord[] };
    const body = JSON.stringify({ items: data.records.map(mapItem) });
    cache = { at: Date.now(), body };
    return { statusCode: 200, headers: json(), body };
  } catch (err) {
    console.error("budget/items error", err);
    return { statusCode: 502, headers: json(), body: JSON.stringify({ error: "items_failed" }) };
  }
}

const json = () => ({ "Content-Type": "application/json", "Cache-Control": "no-store" });
```

### `server/budget/iam-budget.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadAirtablePat",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:us-east-1:ACCOUNT_ID:parameter/matt-grant/airtable/pat"
    }
  ]
}
```

### `.env.example` (append)

```bash
# --- Budget Builder ---
# Name of the SSM SecureString parameter holding the Airtable Personal Access Token.
AIRTABLE_PAT_PARAM=/matt-grant/airtable/pat
AIRTABLE_BASE_ID=appiuSYCexFUmGIOr
AIRTABLE_ITEMS_TABLE=tblehIxTL9TLTTQ0e
```

---

## 13. One-time setup (outside the codebase)

```bash
# 1) Create an Airtable Personal Access Token (scopes: data.records:read, schema.bases:read)
#    in Airtable > Developer hub. Restrict it to the campaign base.

# 2) Store it as an SSM SecureString (least-privilege; never commit it):
aws ssm put-parameter \
  --name "/matt-grant/airtable/pat" \
  --type "SecureString" \
  --value "patXXXXXXXXXXXXXX.XXXXXXXX" \
  --description "Airtable PAT for Matt Grant campaign-expenses base (read-only)"

# 3) Attach server/budget/iam-budget.json to the Lambda/route execution role
#    (replace ACCOUNT_ID and region).

# 4) Mount BudgetBuilder at a staff-only route (e.g. /budget) and ship.
```
