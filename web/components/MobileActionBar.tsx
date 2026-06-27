"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CAMPAIGN } from "@/lib/site";
import { NavIcon } from "@/components/NavIcon";
import { campaignPhase, type CampaignPhase } from "@/lib/campaign-phase";

// Persistent bottom action bar (phones only) — one tap to the campaign's three
// conversion goals without opening the menu. The phase-relevant action is
// emphasized in brick: Donate normally, Vote in the GOTV stretch. Phase is
// computed client-side (null-first) so SSR and first render match.

const ACTIONS = [
  { key: "donate", label: "Donate", href: CAMPAIGN.donateUrl, external: true, icon: "donate" },
  { key: "volunteer", label: "Volunteer", href: "/act", external: false, icon: "volunteer" },
  { key: "vote", label: "Vote", href: "/vote", external: false, icon: "vote" },
] as const;

export function MobileActionBar() {
  const [phase, setPhase] = useState<CampaignPhase>("campaign");
  useEffect(() => {
    setPhase(campaignPhase(Date.now(), CAMPAIGN.electionDate).phase);
  }, []);
  const emphasis = phase === "gotv" ? "vote" : "donate";

  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      {ACTIONS.map((a) => {
        const on = a.key === emphasis;
        const cls = `flex flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
          on ? "text-brick" : "text-ink hover:text-brick"
        }`;
        const inner = (
          <>
            {on && <span aria-hidden className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-brick" />}
            <NavIcon id={a.icon} className="h-[22px] w-[22px]" />
            {a.label}
          </>
        );
        return a.external ? (
          <a key={a.key} href={a.href} target="_blank" rel="noopener noreferrer" className={`relative ${cls}`}>
            {inner}
          </a>
        ) : (
          <Link key={a.key} href={a.href} className={`relative ${cls}`}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
