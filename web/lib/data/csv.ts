// Correct CSV handling, shared by the build-time generators (run via tsx) and the
// request-time manifest loader. Replaces the per-generator `line.split(",")`, which
// silently corrupts any field containing a comma, quote, or newline.
import { z } from "zod";
import { type Resource, ok, fail } from "./resource";

/**
 * RFC-4180 tokenizer: quoted fields, embedded commas, escaped quotes (""),
 * newlines inside quotes, and CRLF. Returns rows of raw (untrimmed) string cells.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; } // normalize CRLF (outside quotes)
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); } // flush a final unterminated line
  return rows;
}

/**
 * Parse a CSV string into header-keyed objects. Blank lines are skipped. Values
 * are trimmed (matching the prior generator behavior) unless `trim: false`.
 */
export function parseCsv(text: string, opts: { trim?: boolean } = {}): { columns: string[]; items: Record<string, string>[] } {
  const trim = opts.trim ?? true;
  const rows = parseCsvRows(text);
  if (rows.length === 0) return { columns: [], items: [] };
  const columns = rows[0];
  const items = rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.length > 0)) // drop empty lines
    .map((cells) => {
      const obj: Record<string, string> = {};
      columns.forEach((key, idx) => {
        const v = cells[idx] ?? "";
        obj[key] = trim ? v.trim() : v;
      });
      return obj;
    });
  return { columns, items };
}

/** The committed manifest shape every CSV generator writes. */
export const CsvManifestSchema = z.object({
  generatedFrom: z.string(),
  columns: z.array(z.string()),
  items: z.array(z.record(z.string())),
});
export type CsvManifest = z.infer<typeof CsvManifestSchema>;

/**
 * Validate a committed CSV manifest (the `{ generatedFrom, columns, items }` JSON
 * a generator wrote) row-by-row against a schema, returning a typed Resource.
 * The app never parses CSV at runtime — only this validated import path.
 */
export function loadCsvManifest<T>(
  manifest: unknown,
  rowSchema: z.ZodType<T>,
  opts: { source: string; fetchedAt?: string },
): Resource<T[]> {
  const base = { source: opts.source, kind: "csv" as const, live: false, fetchedAt: opts.fetchedAt };
  const shape = CsvManifestSchema.safeParse(manifest);
  if (!shape.success) return fail(`invalid manifest for ${opts.source}: ${shape.error.message}`, base);
  const items: T[] = [];
  for (let i = 0; i < shape.data.items.length; i++) {
    const r = rowSchema.safeParse(shape.data.items[i]);
    if (!r.success) return fail(`${opts.source} row ${i} failed validation: ${r.error.message}`, base);
    items.push(r.data);
  }
  return ok(items, { ...base, live: true, count: items.length });
}
