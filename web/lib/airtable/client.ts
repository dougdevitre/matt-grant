// One typed wrapper around the Airtable REST API for the whole campaign app.
//
// Server-only. Every call resolves the workspace token via getSecret("AIRTABLE_API_KEY")
// (env-first, else SSM /matt-grant/AIRTABLE_API_KEY) — the SAME token that reads/writes
// every base in the "Matt Grant for Congress" workspace (see registry.ts). When the token
// is absent (keyless builds) reads degrade to empty and writes throw, so callers can choose
// to surface an honest error or quietly no-op.
//
// This is the low-level transport. Whether a given write is *allowed* is decided one layer
// up by lib/airtable/access.ts (the admin-editable Front-End Access control table) and by the
// dashboard's Clerk staffGate() RBAC. This module performs no authorization of its own.
import "server-only";
import { getSecret } from "@/lib/ssm";

const API_ROOT = "https://api.airtable.com/v0";

export type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

export class AirtableError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = "AirtableError";
  }
}

/** Thrown when no workspace token is configured. Distinct so callers can degrade vs. fail. */
export class AirtableNotConfiguredError extends Error {
  constructor() {
    super("AIRTABLE_API_KEY not configured");
    this.name = "AirtableNotConfiguredError";
  }
}

async function token(): Promise<string> {
  const key = await getSecret("AIRTABLE_API_KEY");
  if (!key) throw new AirtableNotConfiguredError();
  return key;
}

/** True when the workspace token is present (drives empty-state + form copy). */
export async function airtableConfigured(): Promise<boolean> {
  return Boolean(await getSecret("AIRTABLE_API_KEY"));
}

type ListOptions = {
  /** Airtable filterByFormula string. Prefer building from constants to avoid injection. */
  filterByFormula?: string;
  fields?: string[];
  sort?: { field: string; direction?: "asc" | "desc" }[];
  maxRecords?: number;
  pageSize?: number;
  /** ISR revalidate seconds for GETs. Omit for `cache: "no-store"`. */
  revalidate?: number;
};

/**
 * List records, transparently following Airtable's offset pagination up to maxRecords
 * (default 1000). Returns [] when the token is missing or any request fails — reads never
 * throw, so a page render can't crash on a bad key.
 */
export async function listRecords(
  baseId: string,
  tableId: string,
  opts: ListOptions = {},
): Promise<AirtableRecord[]> {
  let key: string;
  try {
    key = await token();
  } catch {
    return [];
  }
  const out: AirtableRecord[] = [];
  const max = opts.maxRecords ?? 1000;
  let offset: string | undefined;
  try {
    do {
      const params = new URLSearchParams();
      if (opts.filterByFormula) params.set("filterByFormula", opts.filterByFormula);
      if (opts.pageSize) params.set("pageSize", String(Math.min(opts.pageSize, 100)));
      for (const f of opts.fields ?? []) params.append("fields[]", f);
      (opts.sort ?? []).forEach((s, i) => {
        params.set(`sort[${i}][field]`, s.field);
        params.set(`sort[${i}][direction]`, s.direction ?? "asc");
      });
      if (offset) params.set("offset", offset);
      const res = await fetch(`${API_ROOT}/${baseId}/${tableId}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${key}` },
        ...(opts.revalidate != null
          ? { next: { revalidate: opts.revalidate } }
          : { cache: "no-store" as const }),
      });
      if (!res.ok) return out;
      const data = (await res.json()) as { records?: AirtableRecord[]; offset?: string };
      out.push(...(data.records ?? []));
      offset = data.offset;
    } while (offset && out.length < max);
  } catch {
    return out;
  }
  return out.slice(0, max);
}

/** Fetch a single record by id, or null if missing / unconfigured / error. */
export async function getRecord(
  baseId: string,
  tableId: string,
  recordId: string,
  revalidate?: number,
): Promise<AirtableRecord | null> {
  let key: string;
  try {
    key = await token();
  } catch {
    return null;
  }
  try {
    const res = await fetch(`${API_ROOT}/${baseId}/${tableId}/${recordId}`, {
      headers: { Authorization: `Bearer ${key}` },
      ...(revalidate != null ? { next: { revalidate } } : { cache: "no-store" as const }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AirtableRecord;
  } catch {
    return null;
  }
}

async function mutate(
  method: "POST" | "PATCH",
  baseId: string,
  tableId: string,
  body: unknown,
): Promise<AirtableRecord[]> {
  const key = await token(); // writes THROW when unconfigured — never silently swallow
  const res = await fetch(`${API_ROOT}/${baseId}/${tableId}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AirtableError(
      `Airtable ${method} failed: ${res.status}`,
      res.status,
      text.slice(0, 300),
    );
  }
  const data = (await res.json()) as { records?: AirtableRecord[]; id?: string };
  return data.records ?? (data.id ? [data as AirtableRecord] : []);
}

/** Create records (≤10 per call; typecast resolves select options by name). Throws on failure. */
export async function createRecords(
  baseId: string,
  tableId: string,
  records: { fields: Record<string, unknown> }[],
  typecast = true,
): Promise<AirtableRecord[]> {
  return mutate("POST", baseId, tableId, { typecast, records });
}

/** Update records by id (≤10 per call). Throws on failure. */
export async function updateRecords(
  baseId: string,
  tableId: string,
  records: { id: string; fields: Record<string, unknown> }[],
  typecast = true,
): Promise<AirtableRecord[]> {
  return mutate("PATCH", baseId, tableId, { typecast, records });
}

/** Delete records by id (≤10 per call). Throws on failure. Returns deleted ids. */
export async function deleteRecords(
  baseId: string,
  tableId: string,
  recordIds: string[],
): Promise<string[]> {
  const key = await token();
  const params = new URLSearchParams();
  for (const id of recordIds) params.append("records[]", id);
  const res = await fetch(`${API_ROOT}/${baseId}/${tableId}?${params.toString()}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AirtableError(`Airtable DELETE failed: ${res.status}`, res.status, text.slice(0, 300));
  }
  const data = (await res.json()) as { records?: { id: string; deleted: boolean }[] };
  return (data.records ?? []).filter((r) => r.deleted).map((r) => r.id);
}
