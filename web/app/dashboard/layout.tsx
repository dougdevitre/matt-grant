import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { DashSidebar } from "@/components/dashboard/DashSidebar";
import { clerkEnabled } from "@/lib/auth";
import { CAMPAIGN } from "@/lib/site";

// Dashboard pages read live data; never statically prerender them.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Only import Clerk's UI when configured — keeps build clean without keys.
  let AuthControl: React.ReactNode = (
    <span className="rounded-sm border border-paper/20 px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-eyebrow text-gold">
      Demo mode
    </span>
  );
  if (clerkEnabled) {
    const { UserButton } = await import("@clerk/nextjs");
    AuthControl = <UserButton afterSignOutUrl="/" />;
  }

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="bg-ink text-paper md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-paper/10 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-gold font-display text-lg font-semibold text-ink">
            ★
          </span>
          <div className="leading-tight">
            <p className="font-display text-base font-semibold">War Room</p>
            <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-paper/60">
              {CAMPAIGN.districtShort} · Aug 4
            </p>
          </div>
        </div>
        <DashSidebar />
        <div className="hidden border-t border-paper/10 px-5 py-5 md:block">
          <p className="eyebrow text-paper/50">Days to election</p>
          <div className="mt-3">
            <Countdown iso={CAMPAIGN.electionDate} compact />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-3 sm:px-8">
          <Link href="/" className="font-mono text-xs uppercase tracking-eyebrow text-slate hover:text-ink">
            ← View public site
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-slate sm:inline">
              {CAMPAIGN.candidate} for Congress
            </span>
            {AuthControl}
          </div>
        </header>
        <div className="flex-1 px-5 py-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}
