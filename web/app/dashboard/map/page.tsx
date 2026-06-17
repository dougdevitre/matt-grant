import Link from "next/link";
import { PageHeader } from "@/components/dashboard/Notice";
import { MapExplorer } from "@/components/MapExplorer";

export const dynamic = "force-dynamic";

export default function MapPage() {
  return (
    <>
      <PageHeader kicker="Region" title="3D field map">
        <Link href="/dashboard/targets" className="btn-ghost">Turn this into a target list →</Link>
      </PageHeader>
      <p className="mb-6 max-w-prose text-sm text-slate">
        A blended view of MO-02 with <strong>live St. Louis County data</strong>: real polling places
        (clipped to the district) and 3D precinct columns extruded by actual{" "}
        <strong>Aug-2024 primary turnout</strong> — the low-turnout electorate that decides Aug 4. Shows
        the <strong>St. Louis County portion</strong> of MO-02; the district also reaches other counties
        not in this feed. Schools, public places, and partners are sample for now.
      </p>
      <MapExplorer />
    </>
  );
}
