// SAMPLE MO-02 geodata for the interactive 3D map. Coordinates are approximate
// and points/turnout are ILLUSTRATIVE placeholders — replace with official GIS
// exports (St. Louis County GIS, MSDIS, Census, OSM). See web/docs and the
// candidate/data-and-map-plan.md for swap-in instructions.

export const MAP_CENTER: [number, number] = [-90.52, 38.62]; // west St. Louis County
export const MAP_ZOOM = 10.4;

export type Category = "schools" | "partners" | "public" | "polling";

export const CATEGORIES: Record<Category, { label: string; color: string; blurb: string }> = {
  schools: { label: "Schools", color: "#16365C", blurb: "Where families gather — children-first message lives here." },
  partners: { label: "Strategic partners", color: "#B5343B", blurb: "Chambers, clubs, committees — coalition anchors. (Sample.)" },
  public: { label: "Public places", color: "#E0A53B", blurb: "Libraries, parks, markets, rec centers — high foot traffic." },
  polling: { label: "Polling places", color: "#0F2540", blurb: "Vote locations — load the official county GIS layer." },
};

export type Poi = { name: string; category: Category; lng: number; lat: number; note?: string };

export const POIS: Poi[] = [
  // Schools (approx; sample)
  { name: "Kirkwood High School", category: "schools", lng: -90.409, lat: 38.576 },
  { name: "Marquette High School (Chesterfield)", category: "schools", lng: -90.543, lat: 38.645 },
  { name: "Lafayette High School (Wildwood)", category: "schools", lng: -90.636, lat: 38.556 },
  { name: "Parkway West High (Ballwin)", category: "schools", lng: -90.521, lat: 38.609 },

  // Public places (approx; sample)
  { name: "Kirkwood Public Library", category: "public", lng: -90.407, lat: 38.583 },
  { name: "Daniel Boone Library (Ellisville)", category: "public", lng: -90.587, lat: 38.593 },
  { name: "Queeny Park (Town & Country)", category: "public", lng: -90.487, lat: 38.617 },
  { name: "Chesterfield Central Park", category: "public", lng: -90.581, lat: 38.661 },
  { name: "Kirkwood Farmers Market", category: "public", lng: -90.406, lat: 38.584 },
  { name: "Vlasis Park (Ballwin)", category: "public", lng: -90.546, lat: 38.595 },

  // Strategic partners (generic/sample — confirm before any public use)
  { name: "West County Chamber of Commerce", category: "partners", lng: -90.546, lat: 38.597, note: "Sample partner" },
  { name: "Chesterfield Chamber of Commerce", category: "partners", lng: -90.571, lat: 38.663, note: "Sample partner" },
  { name: "Local civic club (Rotary/Kiwanis)", category: "partners", lng: -90.454, lat: 38.612, note: "Sample partner" },

  // Polling places (sample — replace with official county GIS export)
  { name: "Sample polling — Kirkwood", category: "polling", lng: -90.412, lat: 38.585, note: "Sample" },
  { name: "Sample polling — Ballwin", category: "polling", lng: -90.55, lat: 38.594, note: "Sample" },
  { name: "Sample polling — Chesterfield", category: "polling", lng: -90.577, lat: 38.659, note: "Sample" },
];

// Build a small square polygon around a center for sample precincts.
function square(lng: number, lat: number, d = 0.018): number[][][] {
  return [[
    [lng - d, lat - d],
    [lng + d, lat - d],
    [lng + d, lat + d],
    [lng - d, lat + d],
    [lng - d, lat - d],
  ]];
}

type PrecinctSeed = { name: string; lng: number; lat: number; turnout: number; lean: number };

const PRECINCT_SEEDS: PrecinctSeed[] = [
  // turnout = illustrative % primary turnout; lean = illustrative GOP-primary intensity 0..1
  { name: "Kirkwood", lng: -90.407, lat: 38.583, turnout: 31, lean: 0.55 },
  { name: "Ballwin", lng: -90.546, lat: 38.595, turnout: 27, lean: 0.62 },
  { name: "Chesterfield", lng: -90.577, lat: 38.66, turnout: 34, lean: 0.6 },
  { name: "Wildwood", lng: -90.636, lat: 38.583, turnout: 38, lean: 0.68 },
  { name: "Ellisville", lng: -90.587, lat: 38.593, turnout: 25, lean: 0.64 },
  { name: "Manchester", lng: -90.51, lat: 38.597, turnout: 22, lean: 0.58 },
  { name: "Town & Country", lng: -90.465, lat: 38.612, turnout: 36, lean: 0.59 },
  { name: "Creve Coeur", lng: -90.423, lat: 38.66, turnout: 29, lean: 0.5 },
];

// Sample precinct layer. `turnout` drives 3D extrusion height; `lean` drives color.
export const PRECINCTS = {
  type: "FeatureCollection" as const,
  features: PRECINCT_SEEDS.map((p) => ({
    type: "Feature" as const,
    properties: { name: p.name, turnout: p.turnout, lean: p.lean },
    geometry: { type: "Polygon" as const, coordinates: square(p.lng, p.lat) },
  })),
};
