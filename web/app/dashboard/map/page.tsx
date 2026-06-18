import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { MapExplorer } from "@/components/MapExplorer";
import { DistrictCoverage } from "@/components/dashboard/DistrictCoverage";

export const dynamic = "force-dynamic";

export default function MapPage() {
  return (
    <>
      <PageHeader kicker="Region" title="3D field map">
        <Link href="/dashboard/targets" className="btn-ghost">Turn this into a target list →</Link>
      </PageHeader>
      <p className="mb-6 max-w-prose text-sm text-slate">
        A blended view of MO-02 with <strong>live St. Louis County data</strong>, scoped to the{" "}
        <strong>2025 enacted map</strong> (county field <span className="font-mono">congress25</span>):
        polling places clipped to the district and 3D precinct columns extruded by actual{" "}
        <strong>Aug-2024 primary turnout</strong>. Shows the <strong>St. Louis County portion</strong> of
        MO-02 (predominantly the western/central suburbs); the district also reaches Jefferson,
        Washington, Crawford, and Gasconade — not in this feed. Schools/public places/partners are sample.
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
