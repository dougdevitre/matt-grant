import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { DashSidebar } from "@/components/dashboard/DashSidebar";
import { DeniedBanner } from "@/components/dashboard/DeniedBanner";
import { clerkEnabled, staffGate } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";
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
  // Backstop: only allowlisted/invited staff get in; role drives what they see.
  const { ok, role } = await staffGate();
  if (clerkEnabled) {
    if (!ok) redirect("/?staff=denied");
    const { UserButton } = await import("@clerk/nextjs");
    AuthControl = <UserButton afterSignOutUrl="/" />;
  }
  const activeRole = role ?? "admin";

  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="bg-ink text-paper md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-paper/10 px-5 py-5">
          <Image
            src="/brand/icon-192.png"
            alt="Matt Grant for Congress"
            width={36}
            height={36}
            className="h-9 w-9 rounded-sm"
            priority
          />
          <div className="leading-tight">
            <p className="font-display text-base font-semibold">Peace Room</p>
            <p className="font-mono text-[0.6rem] uppercase tracking-eyebrow text-paper/60">
              {CAMPAIGN.districtShort} · Aug 4
            </p>
          </div>
        </div>
        {/* Countdown sits at the top of the menu, above the nav, on every
            breakpoint (it used to be hidden md:block at the bottom). */}
        <div className="border-b border-paper/10 px-5 py-4">
          <p className="eyebrow text-paper/50">Days to election</p>
          <div className="mt-3">
            <Countdown iso={CAMPAIGN.electionDate} compact />
          </div>
        </div>
        <DashSidebar role={activeRole} />
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-3 sm:px-8">
          <Link href="/" className="font-mono text-xs uppercase tracking-eyebrow text-slate hover:text-ink">
            ← View public site
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 font-mono text-xs text-slate sm:flex">
              <Image src="/brand/icon-192.png" alt="" width={20} height={20} className="rounded-[3px]" />
              {CAMPAIGN.candidate} for Congress
            </span>
            <span className="rounded-sm bg-ink/5 px-2 py-1 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">
              {ROLE_LABELS[activeRole]}
            </span>
            {AuthControl}
          </div>
        </header>
        <div className="flex-1 px-5 py-8 sm:px-8">
          <Suspense fallback={null}>
            <DeniedBanner />
          </Suspense>
          {children}
        </div>
      </div>
    </div>
  );
}
