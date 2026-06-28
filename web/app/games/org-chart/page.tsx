import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrgChart } from "@/components/games/OrgChart";
import { orgChartContent } from "@/lib/games/org-chart";
import { gameFlags } from "@/lib/games/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // respect the live kill switch

export const metadata: Metadata = {
  title: "Org Chart",
  description: "Right-size the federal workforce to the target band — without gutting families or infrastructure.",
};

export default async function OrgChartPage() {
  const flags = await gameFlags();
  if (flags["org-chart"] === false) notFound(); // compliance kill switch
  return <OrgChart content={orgChartContent} />;
}
