"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { CAMPAIGN, NAV, mainHref, isNavGroup } from "@/lib/site";
import { asRole, homeFor } from "@/lib/rbac";
import { useOnSubdomain } from "@/lib/use-on-subdomain";
import { CtaButton } from "@/components/CtaButton";
import { NavMenu } from "@/components/NavMenu";
import { CtaThumb } from "@/components/CtaThumb";
import { NavIcon } from "@/components/NavIcon";
import { ctaThumbForHref } from "@/lib/cta-images";
import { campaignPhase, type CampaignPhase } from "@/lib/campaign-phase";
import { primaryAction } from "@/lib/nav-actions";

// The header's primary call-to-action, resolved from campaign phase + role.
// `external` actions (WinRed) keep the headshot thumbnail; internal ones (e.g.
// the GOTV "Plan your vote") are SPA links, subdomain-corrected via mainHref.
function PrimaryCta({
  phase,
  role,
  onSubdomain,
  className,
  onClick,
}: {
  phase: CampaignPhase;
  role: string | null;
  onSubdomain: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const a = primaryAction(phase, role);
  return (
    <CtaButton
      href={a.external ? a.href : mainHref(a.href, onSubdomain)}
      external={a.external}
      context={a.context}
      className={className}
      onClick={onClick}
    >
      {a.label}
    </CtaButton>
  );
}

// Same CTA, but reads the signed-in visitor's role so donors see "Give again".
// Only mounted inside <SignedIn>, so useUser() always has a provider.
function SignedInPrimaryCta(props: { phase: CampaignPhase; onSubdomain: boolean; className?: string; onClick?: () => void }) {
  const { user } = useUser();
  const role = asRole((user?.publicMetadata as { role?: unknown } | undefined)?.role);
  return <PrimaryCta {...props} role={role} />;
}

// Resolves the right CTA for the auth context: role-aware when Clerk is on,
// otherwise the plain phase-aware default.
function HeaderPrimaryCta({
  clerkEnabled,
  ...props
}: {
  clerkEnabled: boolean;
  phase: CampaignPhase;
  onSubdomain: boolean;
  className?: string;
  onClick?: () => void;
}) {
  if (!clerkEnabled) return <PrimaryCta {...props} role={null} />;
  return (
    <>
      <SignedOut>
        <PrimaryCta {...props} role={null} />
      </SignedOut>
      <SignedIn>
        <SignedInPrimaryCta {...props} />
      </SignedIn>
    </>
  );
}

// Slim "days to the primary" strip. daysUntil is null until the client computes
// it (keeps SSR/first-render identical — no hydration mismatch), so it simply
// doesn't render until mounted; it also hides once the election has passed.
function CountdownStrip({ daysUntil }: { daysUntil: number | null }) {
  if (daysUntil === null || daysUntil <= 0) return null;
  return (
    <div className="mb-1 flex items-baseline gap-2 border-b border-line/60 px-1 pb-3 pt-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate">Primary · {CAMPAIGN.electionLabel}</span>
      <span className="ml-auto font-display text-base font-semibold text-brick">
        {daysUntil} {daysUntil === 1 ? "day" : "days"}
      </span>
    </div>
  );
}

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
  // Which mobile-drawer group is expanded (accordion: one at a time).
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const closeDrawer = () => {
    setOpen(false);
    setOpenGroup(null);
  };
  // Campaign phase drives the primary CTA (Donate vs. "Plan your vote" in the
  // GOTV stretch) and the countdown. Computed on the client so SSR and the first
  // client render match — defaults to "campaign" until mounted, then corrects.
  const [phase, setPhase] = useState<CampaignPhase>("campaign");
  const [daysUntil, setDaysUntil] = useState<number | null>(null);
  useEffect(() => {
    const p = campaignPhase(Date.now(), CAMPAIGN.electionDate);
    setPhase(p.phase);
    setDaysUntil(p.daysUntil);
  }, []);
  // On a pillar subdomain, main-site links must point back at the apex (a
  // relative "/about" would 404 on the subdomain). On the apex this is a no-op,
  // so client-side SPA navigation is preserved.
  const onSubdomain = useOnSubdomain();

  // The group whose section the visitor is currently in — pre-expanded when the
  // drawer opens so they land oriented rather than on a wall of collapsed rows.
  const activeGroupLabel =
    NAV.find(
      (e) => isNavGroup(e) && e.children.some((c) => pathname === c.href || pathname.startsWith(`${c.href}/`)),
    )?.label ?? null;
  const openDrawer = () => {
    setOpen(true);
    setOpenGroup(activeGroupLabel);
  };

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the drawer on navigation (covers tapping a link and the back button).
  useEffect(() => {
    setOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Focus trap: keep Tab/Shift+Tab cycling within the open drawer instead of
  // leaking to the page behind it. Re-queries each keystroke so it stays correct
  // as accordion groups expand/collapse.
  const onPanelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    if (!f || f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    const activeEl = document.activeElement;
    if (e.shiftKey && (activeEl === first || activeEl === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // While the drawer is open: lock body scroll, move focus into the panel, and
  // close on Escape. All undone on close so the page behaves normally again.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setOpenGroup(null);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    // The drawer is a sibling of <header>, NOT a child: the header's
    // backdrop-blur (a backdrop-filter) establishes a containing block for
    // fixed descendants, which would clamp the fixed drawer to the 68px bar.
    <>
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
          {NAV.map((entry) => {
            if (isNavGroup(entry)) {
              return <NavMenu key={entry.label} group={entry} pathname={pathname} onSubdomain={onSubdomain} />;
            }
            const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
            return (
              <Link
                key={entry.href}
                href={mainHref(entry.href, onSubdomain)}
                className={`relative text-sm font-semibold transition-colors hover:text-ink ${
                  active ? "text-ink" : "text-slate"
                }`}
              >
                {entry.label}
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
          <HeaderPrimaryCta clerkEnabled={clerkEnabled} phase={phase} onSubdomain={onSubdomain} />
        </div>

        <button
          ref={toggleRef}
          className="lg:hidden btn-ghost px-3 py-2"
          aria-label="Toggle menu"
          aria-expanded={open}
          aria-controls="mobile-drawer"
          onClick={() => (open ? closeDrawer() : openDrawer())}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      </header>

      {open && (
        <div
          id="mobile-drawer"
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={onPanelKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="fixed inset-x-0 bottom-0 top-[68px] z-40 overflow-y-auto border-t border-line bg-paper outline-none motion-safe:animate-rise-in lg:hidden"
        >
          <nav className="container-page flex flex-col py-2 pb-10">
            <CountdownStrip daysUntil={daysUntil} />
            {NAV.map((entry) => {
              if (!isNavGroup(entry)) {
                const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
                return (
                  <Link
                    key={entry.href}
                    href={mainHref(entry.href, onSubdomain)}
                    onClick={closeDrawer}
                    className={`border-b border-line/60 py-3.5 font-display text-lg font-semibold ${active ? "text-brick" : "text-ink"}`}
                  >
                    {entry.label}
                  </Link>
                );
              }
              const expanded = openGroup === entry.label;
              const groupActive = entry.children.some(
                (c) => pathname === c.href || pathname.startsWith(`${c.href}/`),
              );
              return (
                <div key={entry.label} className="border-b border-line/60">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroup((g) => (g === entry.label ? null : entry.label))}
                    className="flex w-full items-center gap-3 py-3.5 text-left"
                  >
                    <NavIcon
                      id={entry.icon}
                      className={`h-[22px] w-[22px] shrink-0 transition-colors ${expanded || groupActive ? "text-brick" : "text-ink"}`}
                    />
                    <span className="font-display text-lg font-semibold text-ink">{entry.label}</span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 12 12"
                      className={`ml-auto h-3.5 w-3.5 text-slate transition-transform ${expanded ? "rotate-180" : ""}`}
                    >
                      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {expanded && (
                    // Signature: a brick "ballot rail" down the children — each row
                    // marked like a ballot line; mapped children show their circular
                    // thumbnail in the same slot so rows stay aligned.
                    <ul className="mb-3 ml-[10px] border-l-2 border-brick pl-4">
                      {entry.children.map((child) => {
                        const thumb = ctaThumbForHref(child.href);
                        const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <li key={child.href}>
                            <Link
                              href={mainHref(child.href, onSubdomain)}
                              onClick={closeDrawer}
                              className={`flex items-center gap-3 py-2 text-[15px] font-semibold transition-colors hover:text-brick ${childActive ? "text-brick" : "text-ink"}`}
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                                {thumb ? (
                                  <CtaThumb thumb={thumb} circle size={28} className="ring-1 ring-brick/30" />
                                ) : (
                                  <span className="h-[7px] w-[7px] rounded-full bg-brick" />
                                )}
                              </span>
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}

            {clerkEnabled && (
              <div className="mt-3 border-t border-line pt-3">
                <p className="px-1 pb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-slate">Your account</p>
                <SignedOut>
                  <Link href={mainHref("/sign-in", onSubdomain)} onClick={closeDrawer} className="block py-2.5 text-[15px] font-semibold text-slate hover:text-ink">
                    Sign in
                  </Link>
                </SignedOut>
                <SignedIn>
                  <AccountLink
                    className="block py-2.5 text-[15px] font-semibold text-slate hover:text-ink"
                    onNavigate={closeDrawer}
                    onSubdomain={onSubdomain}
                  />
                  <div className="flex items-center gap-2 py-2.5 text-[15px] font-semibold text-slate">
                    <UserButton afterSignOutUrl="/" /> Account &amp; sign out
                  </div>
                </SignedIn>
              </div>
            )}

            <HeaderPrimaryCta
              clerkEnabled={clerkEnabled}
              phase={phase}
              onSubdomain={onSubdomain}
              className="btn-primary mt-4"
              onClick={closeDrawer}
            />
          </nav>
        </div>
      )}
    </>
  );
}
