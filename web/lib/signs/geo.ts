// GeoJSON adapters for the field map's signs layer — pure, unit-tested. The
// /api/geo/signs route maps stored placements through these; the map colors by
// the `verified` property.

import type { SignPlacementRecord } from "@/lib/signs/persistence";
import type { PlacementInput } from "@/lib/signs/placement";

/** Deployable per the scoring pipeline's hard gates (lib/signs/placement.ts hardFilter):
 *  in-district AND buffer verified AND property permission. */
export function signVerified(p: Pick<PlacementInput, "inDistrict" | "bufferVerified" | "propertyPermission">): boolean {
  return p.inDistrict && p.bufferVerified && p.propertyPermission;
}

/** One saved placement → a map feature. Caller filters to rows with coordinates. */
export function signFeature(r: SignPlacementRecord & { lat: number; lng: number }): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {
      id: r.id,
      name: r.name,
      type: r.type,
      verified: signVerified(r),
      captainId: r.captainId ?? "",
      notes: r.notes ?? "",
    },
    geometry: { type: "Point", coordinates: [r.lng, r.lat] },
  };
}
