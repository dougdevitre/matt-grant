import { PageHeader } from "@/components/dashboard/Notice";
import { MapExplorer } from "@/components/MapExplorer";

export const dynamic = "force-dynamic";

export default function MapPage() {
  return (
    <>
      <PageHeader kicker="Region" title="3D field map" />
      <p className="mb-6 max-w-prose text-sm text-slate">
        A blended view of MO-02 with <strong>live St. Louis County data</strong>: 196 real polling
        places and 3D precinct columns extruded by actual <strong>Aug-2024 primary turnout</strong> —
        the same low-turnout electorate that decides Aug 4. Schools, public places, and partner
        anchors are sample for now. Built to drive the "show up everywhere" ground game.
      </p>
      <MapExplorer />
    </>
  );
}
