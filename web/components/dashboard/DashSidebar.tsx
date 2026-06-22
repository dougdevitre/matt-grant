"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashIcon } from "./DashIcon";
import { can, type Capability, type Role } from "@/lib/rbac";

const ITEMS: { href: string; label: string; icon: string; cap: Capability }[] = [
  { href: "/dashboard", label: "Overview", icon: "overview", cap: "viewOverview" },
  { href: "/dashboard/peace-room", label: "Peace Room", icon: "plan", cap: "viewPeaceRoom" },
  { href: "/dashboard/donors", label: "Donors", icon: "donors", cap: "viewFinanceTotals" },
  { href: "/dashboard/finance", label: "Finance", icon: "finance", cap: "viewFinanceTotals" },
  { href: "/dashboard/compliance", label: "Compliance", icon: "compliance", cap: "viewCompliance" },
  { href: "/dashboard/map", label: "3D field map", icon: "map", cap: "viewMap" },
  { href: "/dashboard/targets", label: "Precinct targets", icon: "targets", cap: "viewTargets" },
  { href: "/dashboard/studio", label: "Graphics studio", icon: "studio", cap: "useStudio" },
  { href: "/dashboard/assets", label: "Asset library", icon: "assets", cap: "manageAssets" },
  { href: "/dashboard/photos", label: "Photo library", icon: "photos", cap: "viewPhotos" },
  { href: "/dashboard/volunteers", label: "Volunteers", icon: "volunteers", cap: "manageVolunteers" },
  { href: "/dashboard/tasks", label: "Task board", icon: "tasks", cap: "manageTasks" },
  { href: "/dashboard/emails", label: "Email campaigns", icon: "campaign", cap: "draftEmailCampaign" },
  { href: "/dashboard/research", label: "Opp. research", icon: "research", cap: "viewResearch" },
  { href: "/dashboard/plan", label: "Strategic plan", icon: "plan", cap: "viewPlan" },
  { href: "/dashboard/team", label: "Team & access", icon: "team", cap: "manageTeam" },
];

export function DashSidebar({ role = "admin" }: { role?: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:gap-0.5 md:overflow-visible md:p-4">
      {ITEMS.filter((item) => can(role, item.cap)).map((item) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 whitespace-nowrap rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-gold/15 text-goldlight" : "text-paper/70 hover:bg-paper/5 hover:text-paper"
            }`}
          >
            <DashIcon name={item.icon} className="h-[1.15rem] w-[1.15rem] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
