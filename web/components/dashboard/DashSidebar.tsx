"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashIcon } from "./DashIcon";
import { can, type Capability, type Role } from "@/lib/rbac";

type Item = { href: string; label: string; icon: string; cap: Capability };
type Group = { label?: string; items: Item[] };

// Grouped by task. Each item still carries the capability that gates it, so a
// whole section disappears when the role can't see any of its items (e.g. a
// supporter/partner sees only the Peace Room). Daily/overview first; admin last.
// Labels are short and plain (e.g. "Map", "Research") so the menu scans fast.
const GROUPS: Group[] = [
  { items: [{ href: "/dashboard", label: "Overview", icon: "overview", cap: "viewOverview" }] },
  {
    label: "Fundraising",
    items: [
      { href: "/dashboard/donors", label: "Donors", icon: "donors", cap: "viewFinanceTotals" },
      { href: "/dashboard/finance", label: "Finance", icon: "finance", cap: "viewFinanceTotals" },
      { href: "/dashboard/compliance", label: "Compliance", icon: "compliance", cap: "viewCompliance" },
    ],
  },
  {
    label: "Field",
    items: [
      { href: "/dashboard/map", label: "Map", icon: "map", cap: "viewMap" },
      { href: "/dashboard/targets", label: "Targets", icon: "targets", cap: "viewTargets" },
      { href: "/dashboard/volunteers", label: "Volunteers", icon: "volunteers", cap: "manageVolunteers" },
      { href: "/dashboard/events", label: "Events", icon: "tasks", cap: "manageEvents" },
      { href: "/dashboard/tasks", label: "Task board", icon: "tasks", cap: "manageTasks" },
      { href: "/dashboard/influencers", label: "Influencers", icon: "targets", cap: "manageTasks" },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/dashboard/studio", label: "Graphics", icon: "studio", cap: "useStudio" },
      // Photos folded into Assets — reach the photo library from the Assets page.
      { href: "/dashboard/assets", label: "Assets", icon: "assets", cap: "manageAssets" },
      { href: "/dashboard/print", label: "Print", icon: "assets", cap: "manageAssets" },
      { href: "/dashboard/emails", label: "Email", icon: "campaign", cap: "draftEmailCampaign" },
      { href: "/dashboard/sms", label: "Text blasts", icon: "campaign", cap: "draftSms" },
      { href: "/dashboard/messages", label: "Inbox", icon: "campaign", cap: "messageIndividuals" },
      { href: "/dashboard/social", label: "Social", icon: "social", cap: "manageSocial" },
    ],
  },
  {
    label: "Strategy",
    items: [
      { href: "/dashboard/research", label: "Research", icon: "research", cap: "viewResearch" },
      { href: "/dashboard/data", label: "Data sources", icon: "research", cap: "viewResearch" },
      { href: "/dashboard/plan", label: "Strategic plan", icon: "plan", cap: "viewPlan" },
    ],
  },
  // Peace Room + Team share an unlabeled trailing group: a supporter/partner
  // sees only Peace Room (no confusing "Admin" header), while staff also see Team.
  {
    items: [
      { href: "/dashboard/peace-room", label: "Peace Room", icon: "plan", cap: "viewPeaceRoom" },
      { href: "/dashboard/team", label: "Team & access", icon: "team", cap: "manageTeam" },
      { href: "/dashboard/setup", label: "Setup & status", icon: "compliance", cap: "manageTeam" },
    ],
  },
];

export function DashSidebar({ role = "admin" }: { role?: Role }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:gap-0.5 md:overflow-visible md:p-4">
      {GROUPS.map((group, gi) => {
        const items = group.items.filter((item) => can(role, item.cap));
        if (items.length === 0) return null; // hide the whole section + its header
        return (
          <Fragment key={group.label ?? gi}>
            {group.label && (
              // Section label: visible on the stacked desktop sidebar; hidden on
              // the mobile horizontal bar so links stay in one clean row.
              // text-paper/60 (~6:1 on the navy sidebar) clears WCAG AA contrast;
              // /40 was 3.52:1 and failed the axe a11y check.
              <p className="mt-4 hidden px-3 pb-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-paper/60 md:block">
                {group.label}
              </p>
            )}
            {items.map((item) => {
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
          </Fragment>
        );
      })}
    </nav>
  );
}
