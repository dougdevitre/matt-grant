// Server-only data access for the budget builder's Items catalog.
// Reads via the shared workspace Airtable client (token resolved from SSM/env);
// the PAT never reaches the client. Falls back to the offline seed catalog so the
// planner still works during an Airtable outage / before the token is wired.
import "server-only";
import { listRecords, type AirtableRecord } from "@/lib/airtable/client";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";
import type { Item } from "./types";
import { SEED_ITEMS } from "./plan";

const BASE = AIRTABLE_BASES.budget.id;
const ITEMS = AIRTABLE_BASES.budget.tables.items;

function mapItem(r: AirtableRecord): Item {
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

/**
 * Live catalog from Airtable. `live` is false when the fetch yields nothing
 * (outage / no token / empty table) and the seed catalog is returned instead, so
 * callers can show an honest "offline catalog" banner.
 */
export async function getBudgetItems(): Promise<{ items: Item[]; live: boolean }> {
  const records = await listRecords(BASE, ITEMS, { revalidate: 60, pageSize: 100 });
  if (!records.length) return { items: SEED_ITEMS, live: false };
  // Only surface catalog rows that aren't archived/inactive if a Status is set.
  const items = records
    .map(mapItem)
    .filter((it) => it.name);
  return items.length ? { items, live: true } : { items: SEED_ITEMS, live: false };
}
