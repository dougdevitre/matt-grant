import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { clerkEnabled } from "@/lib/auth";

// Host shell for the Four Fights arcade (games.mattgrantforcongress.org). Reuses the
// site header + footer so every game screen inherits the shared chrome AND the FEC
// disclaimer the SiteFooter renders from CAMPAIGN.paidForBy (compliance §12: a
// disclaimer on every screen). The games subdomain rewrites to /games via the
// reserved-subdomain rule in lib/pillar-routing.ts.

export const metadata: Metadata = {
  title: { default: "Four Fights Arcade", template: "%s — Four Fights Arcade" },
  description: "Play a quick civic mini-game for each of Matt Grant's four priorities for MO-02.",
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader clerkEnabled={clerkEnabled} />
      <main id="main" className="container-page py-10 sm:py-14">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
