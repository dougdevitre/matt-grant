import "server-only";
import { listRecords } from "@/lib/airtable/client";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

// Canonical geographic regions, read from the Airtable Geo Hierarchy table — the
// source of truth for how MO-02 is divided (county → city/township → precinct).
// Captains are assigned to these regions (vs. free-text areas) so coverage is
// splittable and mappable. Server-only read; [] when Airtable is unconfigured.
const BASE = AIRTABLE_BASES.volunteer;

// `id` is the Airtable record id (so a linked Parent Area that resolves to an id
// can be walked); `parent` is the raw Parent Area value (a name or linked id(s));
// `zips` are the ZIP codes that belong to this region (optional Airtable field),
// enabling precise ZIP→region placement when present.
export type Region = { id?: string; name: string; level: string; parent: string | null; zips?: string[] };

// Pull every 5-digit ZIP out of an Airtable field value (text "63122, 63124" or an
// array). Deduped; [] when absent.
function parseZips(raw: unknown): string[] {
  if (!raw) return [];
  const text = Array.isArray(raw) ? raw.join(" ") : String(raw);
  return [...new Set(text.match(/\d{5}/g) ?? [])];
}

export async function listRegions(): Promise<Region[]> {
  try {
    const recs = await listRecords(BASE.id, BASE.tables.geoHierarchy, {
      fields: ["Area Name", "Geo Level", "Parent Area", "ZIPs"],
      pageSize: 100,
      revalidate: 3600,
    });
    return recs
      .map((r) => ({
        id: r.id,
        name: String(r.fields["Area Name"] ?? "").trim(),
        level: String(r.fields["Geo Level"] ?? "").trim(),
        parent: r.fields["Parent Area"] ? String(r.fields["Parent Area"]) : null,
        zips: parseZips(r.fields["ZIPs"]),
      }))
      .filter((r) => r.name)
      .sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
