import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { MapExplorer } from "@/components/MapExplorer";
import { DistrictCoverage } from "@/components/dashboard/DistrictCoverage";
import { requireCap } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MapPage({ searchParams }: { searchParams: Promise<{ precinct?: string }> }) {
  await requireCap("viewMap");
  const { precinct } = await searchParams;
  return (
    <>
      <PageHeader kicker="Region" title="3D field map">
        <Link href="/dashboard/targets" className="btn-ghost">Turn this into a target list →</Link>
      </PageHeader>
      <p className="mb-5 max-w-prose text-sm text-slate">
        MO-02 in 3D: precinct columns extruded by real <strong>Aug-2024 primary turnout</strong> with
        live St. Louis County polling places. <strong>Click any column to target that precinct.</strong>{" "}
        Coverage, layers, and data provenance are in the panels below.
      </p>
      <HowTo
        steps={[
          "Drag to pan, scroll to zoom, and tilt to read the 3D precinct columns — taller columns are higher Aug-2024 primary turnout.",
          "Switch the column mode to Target tier (A/B/C — the same ranking as the Targets page) or GOTV upside (registered voters who sat out the last primary) to read strategy, not just history.",
          "Jump anywhere with the search box above the map — precincts, municipalities, polling places, events, counties, and saved sign locations.",
          "Click a precinct or polling place to see its underlying numbers, including its target tier and play.",
          "Toggle the Signs layer on to see saved sign placements from the Signs page — blue = verified (all three compliance gates), amber = pending verification.",
          "Use the district-coverage panel below to see which data layers are loaded.",
          "Remember this feed is the St. Louis County portion of MO-02 only; the rural counties are not yet included.",
          "Ready to act on it? Click “Turn this into a target list →” to rank precincts on the Targets page — and each Targets row links back here, zoomed to its precinct.",
        ]}
      />
      <MapExplorer initialPrecinct={precinct} />
      <DistrictCoverage />
    </>
  );
}
