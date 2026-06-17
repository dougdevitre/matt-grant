import { PageHeader } from "@/components/dashboard/Notice";
import { MapExplorer } from "@/components/MapExplorer";

export const dynamic = "force-dynamic";

export default function MapPage() {
  return (
    <>
      <PageHeader kicker="Region" title="3D field map" />
      <p className="mb-6 max-w-prose text-sm text-slate">
        A blended view of MO-02: schools and public places where voters spend time, sample partner
        anchors, polling locations, and 3D precinct columns that fuse boundary data with turnout.
        Built to drive the "show up everywhere" ground game. All sample data is illustrative — load
        official 2026 GIS layers to make it live.
      </p>
      <MapExplorer />
    </>
  );
}
