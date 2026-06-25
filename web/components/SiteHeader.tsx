"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { CAMPAIGN, NAV, mainHref } from "@/lib/site";
import { asRole, homeFor } from "@/lib/rbac";
import { useOnSubdomain } from "@/lib/use-on-subdomain";

// Role-aware "your account" link. Reads publicMetadata.role (exposed to the client
// by design) and points each tier at their own home via the canonical homeFor()
// map in rbac.ts — staff → /dashboard, donor → their giving page, partner/supporter
// → the shared Peace Room, not-yet-stamped → the /community floor. Only rendered
// inside <SignedIn> when Clerk is on, so useUser() always has a provider.
function AccountLink({ className, onNavigate, onSubdomain }: { className: string; onNavigate?: () => void; onSubdomain: boolean }) {
  const { user } = useUser();
  const dest = homeFor(asRole((user?.publicMetadata as { role?: unknown } | undefined)?.role));
  return (
    <Link href={mainHref(dest.href, onSubdomain)} onClick={onNavigate} className={className}>
      {dest.label}
    </Link>
  );
}

// clerkEnabled is passed from the (server) layout: the Clerk account controls
// only render when ClerkProvider is mounted (it isn't in keyless demo mode).
export function SiteHeader({ clerkEnabled = false }: { clerkEnabled?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // On a pillar subdomain, main-site links must point back at the apex (a
  // relative "/about" would 404 on the subdomain). On the apex this is a no-op,
  // so client-side SPA navigation is preserved.
  const onSubdomain = useOnSubdomain();

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <Link href={mainHref("/", onSubdomain)} className="flex items-center" onClick={() => setOpen(false)} aria-label="Matt Grant for Congress — home">
          <Image
            src="/brand/logo.png"
            alt={`Matt Grant for Congress — ${CAMPAIGN.district}`}
            width={132}
            height={132}
            priority
            className="h-12 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={mainHref(item.href, onSubdomain)}
                className={`relative text-sm font-semibold transition-colors hover:text-ink ${
                  active ? "text-ink" : "text-slate"
                }`}
              >
                {item.label}
                {active && <span className="absolute -bottom-[26px] left-0 h-[3px] w-full bg-gold" />}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {clerkEnabled && (
            <>
              <SignedOut>
                <Link href={mainHref("/sign-in", onSubdomain)} className="text-sm font-semibold text-slate transition-colors hover:text-ink">
                  Sign in
                </Link>
              </SignedOut>
              <SignedIn>
                <AccountLink className="text-sm font-semibold text-slate transition-colors hover:text-ink" onSubdomain={onSubdomain} />
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          )}
          <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Donate
          </a>
        </div>

        <button
          className="lg:hidden btn-ghost px-3 py-2"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper lg:hidden">
          <nav className="container-page flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={mainHref(item.href, onSubdomain)}
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3 text-sm font-semibold text-ink"
              >
                {item.label}
              </Link>
            ))}
            {clerkEnabled && (
              <>
                <SignedOut>
                  <Link href={mainHref("/sign-in", onSubdomain)} onClick={() => setOpen(false)} className="border-b border-line/60 py-3 text-sm font-semibold text-ink">
                    Sign in
                  </Link>
                </SignedOut>
                <SignedIn>
                  <AccountLink
                    className="border-b border-line/60 py-3 text-sm font-semibold text-ink"
                    onNavigate={() => setOpen(false)}
                    onSubdomain={onSubdomain}
                  />
                  <div className="flex items-center gap-2 py-3 text-sm font-semibold text-ink">
                    <UserButton afterSignOutUrl="/" /> Account &amp; sign out
                  </div>
                </SignedIn>
              </>
            )}
            <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
              Donate
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
