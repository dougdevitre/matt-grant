// Forward-geocode an event's street address to map coordinates using the U.S.
// Census Geocoder — free, no API key, US-only — which fits this app's keyless
// stack (OpenFreeMap tiles + Census data). Best-effort: any failure returns null
// so a save never blocks on geocoding. The map layer only plots events that
// resolved (or were given manual lat/lng).
//
// Endpoint: geocoding.geo.census.gov/geocoder/locations/onelineaddress
//   ?address=<one-line>&benchmark=Public_AR_Current&format=json
// Response: { result: { addressMatches: [ { coordinates: { x: <lng>, y: <lat> } } ] } }

export type LatLng = { lat: number; lng: number };

const GEOCODER = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";

// Pure: pull the first match's coordinates out of a Census geocoder response.
// Exported for unit testing without a network call. Census returns x=lng, y=lat.
export function parseCensusGeocode(json: unknown): LatLng | null {
  const matches = (json as { result?: { addressMatches?: unknown[] } })?.result?.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const c = (matches[0] as { coordinates?: { x?: unknown; y?: unknown } })?.coordinates;
  const lng = Number(c?.x);
  const lat = Number(c?.y);
  if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

// Build the one-line address the geocoder expects. Needs at least a street line;
// a bare city name won't match a street address, so we require an address.
export function oneLineAddress(loc: { address?: string; city?: string; county?: string }): string | null {
  const street = (loc.address ?? "").trim();
  if (!street) return null;
  const parts = [street, (loc.city ?? "").trim(), "MO"].filter(Boolean);
  return parts.join(", ");
}

export async function geocodeAddress(loc: { address?: string; city?: string; county?: string }): Promise<LatLng | null> {
  const oneLine = oneLineAddress(loc);
  if (!oneLine) return null;
  try {
    const url = `${GEOCODER}?address=${encodeURIComponent(oneLine)}&benchmark=Public_AR_Current&format=json`;
    // Hard timeout: Node fetch never times out on its own, and this now runs in
    // read paths (Airtable event lists), not just saves — a hung geocoder must
    // degrade to "unplotted", never stall a page render or a build prerender.
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return parseCensusGeocode(await res.json());
  } catch {
    return null;
  }
}
