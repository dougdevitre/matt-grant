import "server-only";
import { listRecords } from "@/lib/airtable/client";
import { AIRTABLE_BASES } from "@/lib/airtable/registry";

// Canonical geographic regions, read from the Airtable Geo Hierarchy table — the
// source of truth for how MO-02 is divided (county → city/township → precinct).
// Captains are assigned to these regions (vs. free-text areas) so coverage is
// splittable and mappable. Server-only read; [] when Airtable is unconfigured.
const BASE = AIRTABLE_BASES.volunteer;

export type Region = { name: string; level: string; parent: string | null };

export async function listRegions(): Promise<Region[]> {
  try {
    const recs = await listRecords(BASE.id, BASE.tables.geoHierarchy, {
      fields: ["Area Name", "Geo Level", "Parent Area"],
      pageSize: 100,
      revalidate: 3600,
    });
    return recs
      .map((r) => ({
        name: String(r.fields["Area Name"] ?? "").trim(),
        level: String(r.fields["Geo Level"] ?? "").trim(),
        parent: r.fields["Parent Area"] ? String(r.fields["Parent Area"]) : null,
      }))
      .filter((r) => r.name)
      .sort((a, b) => a.level.localeCompare(b.level) || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
