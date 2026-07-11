// Store for vendor-appended voter phones (voter-file-plan.md §6). SK = voter id
// (exact match — strongest) or "nz:<name>|<zip5>" for name+zip-keyed rows, so a
// re-import of the same file UPSERTS instead of duplicating. Manual-dial CALL
// lists only — these rows never feed the SMS pipeline.
import "server-only";
import { TABLE, PK, dbConfigured, queryAllPages } from "@/lib/db";
import { batchWritePut } from "@/lib/integrations/batchWrite";
import type { AppendedPhone } from "./phoneAppend";

const sk = (r: AppendedPhone): string =>
  r.voterId ?? `nz:${(r.name ?? "").trim().toLowerCase()}|${r.zip ?? ""}`;

/** Upsert appended rows (batchWritePut = last write wins per SK). */
export async function putAppendedPhones(rows: AppendedPhone[]): Promise<number> {
  if (!dbConfigured || rows.length === 0) return 0;
  const now = new Date().toISOString();
  const items = rows.map((r) => ({
    PK: PK.voterPhones,
    SK: sk(r),
    ...(r.voterId ? { voterId: r.voterId } : {}),
    ...(r.name ? { name: r.name } : {}),
    ...(r.zip ? { zip: r.zip } : {}),
    phone: r.phone,
    source: r.source,
    importedAt: now,
  }));
  await batchWritePut(items);
  return items.length;
}

/** Every appended row. Bounded by import caps (10k/paste) — fine to list. */
export async function listAppendedPhones(): Promise<AppendedPhone[]> {
  if (!dbConfigured) return [];
  try {
    const items = await queryAllPages({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK.voterPhones },
    });
    return items
      .map((it): AppendedPhone | null => {
        const phone = typeof it.phone === "string" ? it.phone : "";
        if (!phone) return null;
        return {
          ...(typeof it.voterId === "string" ? { voterId: it.voterId } : {}),
          ...(typeof it.name === "string" ? { name: it.name } : {}),
          ...(typeof it.zip === "string" ? { zip: it.zip } : {}),
          phone,
          source: typeof it.source === "string" ? it.source : "vendor-append",
        };
      })
      .filter((r): r is AppendedPhone => r !== null);
  } catch {
    return [];
  }
}
