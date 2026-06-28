import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { MapExplorer } from "@/components/MapExplorer";
import { DistrictCoverage } from "@/components/dashboard/DistrictCoverage";
import { requireCap } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  await requireCap("viewMap");
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
          "Click a precinct or polling place to see its underlying numbers.",
          "Use the district-coverage panel below to see which data layers are loaded.",
          "Remember this feed is the St. Louis County portion of MO-02 only; the rural counties are not yet included.",
          "Ready to act on it? Click “Turn this into a target list →” to rank precincts on the Targets page.",
        ]}
      />
      <MapExplorer />
      <DistrictCoverage />
    </>
  );
}
