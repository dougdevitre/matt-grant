"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "▤" },
  { href: "/dashboard/donors", label: "Donors", icon: "◈" },
  { href: "/dashboard/volunteers", label: "Volunteers", icon: "✶" },
  { href: "/dashboard/tasks", label: "Task board", icon: "▥" },
  { href: "/dashboard/plan", label: "Strategic plan", icon: "★" },
];

export function DashSidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:gap-0.5 md:overflow-visible md:p-4">
      {ITEMS.map((item) => {
        const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 whitespace-nowrap rounded-sm px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-gold/15 text-gold" : "text-paper/70 hover:bg-paper/5 hover:text-paper"
            }`}
          >
            <span className="font-mono text-base leading-none" aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
