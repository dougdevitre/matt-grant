import Link from "next/link";
import Image from "next/image";
import { type ReactNode } from "react";
import { CAMPAIGN, NAV_LINKS, LEGAL, VALUES, VOTER_LOOKUP, FEC, SOCIALS, type SocialId, mainHref } from "@/lib/site";
import { GAMES } from "@/lib/games/registry";

// Server component (no host at render time), so footer links to the main site are
// always absolute to the apex. That's correct on every pillar subdomain and on the
// apex itself; footers don't need client-side SPA nav, so the full-load is fine.
const apex = (path: string) => mainHref(path, true);

// Shared link treatment: a goldlight underline that grows from the left on hover.
const linkClass =
  "relative inline-block text-paper/80 transition-colors duration-200 hover:text-goldlight " +
  "after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-0 after:bg-goldlight " +
  "after:transition-all after:duration-200 hover:after:w-full";

// The committee address is one canonical string in lib/site.ts. Render it on two
// readable lines — street on top, "City, ST ZIP" below — derived from the source of
// truth (no re-typed address) so it can't drift from the filed FEC record.
const addressParts = CAMPAIGN.address.split(", ");
const addressCity = addressParts.slice(-2).join(", "); // "St. Louis, MO 63131"
const addressStreet = addressParts.slice(0, -2).join(", "); // everything before the city

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-goldlight">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-goldlight">
      <path
        d="M6.5 4h2.5l1.4 4-2 1.3a11 11 0 0 0 4.8 4.8l1.3-2 4 1.4V18a2 2 0 0 1-2 2A14 14 0 0 1 4.5 6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-goldlight">
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// Brand glyphs for the social row. facebookGroup reuses the Facebook mark.
const SOCIAL_ICONS: Record<SocialId, ReactNode> = {
  x: (
    <path d="M3 3h3.7l5 6.9L17.4 3H21l-7 8.7L21.3 21h-3.7l-5.3-7.3L6 21H2.5l7.4-9.1L3 3Z" fill="currentColor" />
  ),
  facebook: (
    <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.3c0-.8.3-1.4 1.5-1.4h1.3V5.4c-.6-.1-1.4-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9v2.1H7.7V14h2.2v7h3.6Z" fill="currentColor" />
  ),
  facebookGroup: (
    <path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.3c0-.8.3-1.4 1.5-1.4h1.3V5.4c-.6-.1-1.4-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9v2.1H7.7V14h2.2v7h3.6Z" fill="currentColor" />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <circle cx="17" cy="7" r="1.1" fill="currentColor" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="3.4" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M10.5 9.2 15 12l-4.5 2.8V9.2Z" fill="currentColor" />
    </>
  ),
  tiktok: (
    <path d="M13.5 3c.3 2 1.6 3.6 3.7 3.9v2.4c-1.2 0-2.4-.4-3.4-1v5.6a4.8 4.8 0 1 1-4.8-4.8c.3 0 .5 0 .8.1v2.5a2.3 2.3 0 1 0 1.6 2.2V3h2.1Z" fill="currentColor" />
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7" fill="none" />
      <path d="M7 10v6M7 7.2v0M10.5 16v-3.3c0-1.3.9-2.2 2.1-2.2s2 .9 2 2.3V16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </>
  ),
};

// Only render socials that have a verified URL — blanks in SOCIALS stay invisible.
const liveSocials = SOCIALS.filter((s) => s.url.trim().length > 0);
// Arcade links: the live games (build-time default) plus the hub.
const liveGames = GAMES.filter((g) => g.enabled);

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-paper">
      {/* Tricolor banner edge — mirrors the hero's top rule, with a slow moving sheen */}
      <div className="relative h-1 w-full overflow-hidden bg-gradient-to-r from-brick via-paper to-field" aria-hidden>
        <div className="absolute inset-y-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/60 to-transparent motion-reduce:hidden" />
      </div>

      {/* Layered, vibrant background: deep wash + portrait atmosphere + ledger grid + color glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink to-field/55" />
        <div className="absolute inset-y-0 right-0 hidden w-[46%] lg:block">
          <Image
            src="/brand/portrait-1200.png"
            alt=""
            fill
            sizes="46vw"
            className="object-cover object-top opacity-[0.12] [mask-image:linear-gradient(to_left,rgba(0,0,0,0.85),transparent_72%)]"
          />
        </div>
        <div className="absolute inset-0 bg-grid opacity-[0.16] mix-blend-soft-light" />
        <div className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-brick/20 blur-3xl" />
        <div className="absolute -bottom-10 right-10 h-80 w-80 rounded-full bg-gold/25 blur-3xl" />
      </div>

      <div className="relative">
        <div className="container-page grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.9fr_1.1fr_0.9fr_0.9fr]">
          {/* Brand + CTA */}
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-md bg-white p-1.5 shadow-card ring-1 ring-paper/20">
                <Image src="/brand/logo.png" alt="Matt Grant for Congress" width={56} height={56} className="h-full w-auto" />
              </span>
              <span className="font-display text-xl font-semibold leading-tight">
                Matt Grant
                <span className="block text-sm font-normal text-paper/70">for Congress · {CAMPAIGN.districtShort}</span>
              </span>
            </div>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-paper/75">
              {CAMPAIGN.tagline} {CAMPAIGN.promise}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-paper/15 bg-field/40 px-3 py-1.5 text-xs font-medium text-paper/85 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-goldlight" aria-hidden />
              Election day · {CAMPAIGN.electionLabel}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={CAMPAIGN.donateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold shadow-[0_10px_30px_-10px_rgba(37,99,235,0.7)] transition-shadow hover:shadow-[0_14px_34px_-8px_rgba(37,99,235,0.85)]"
              >
                Donate today
              </a>
              <Link href={apex("/act")} className="btn-ghost border-paper/30 text-paper hover:border-paper">
                Get involved
              </Link>
            </div>

            {liveSocials.length > 0 ? (
              <div className="mt-6 flex items-center gap-3">
                {liveSocials.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-paper/15 bg-field/30 text-paper/80 transition-colors hover:border-goldlight/60 hover:text-goldlight"
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]">{SOCIAL_ICONS[s.id]}</svg>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {/* Campaign nav */}
          <div>
            <h3 className="eyebrow text-paper/60">Campaign</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={apex(item.href)} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={apex("/dashboard")} className={linkClass}>
                  Staff sign-in
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="eyebrow text-paper/60">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a href={`mailto:${CAMPAIGN.email}`} className="flex items-start gap-2.5 text-paper/80 transition-colors hover:text-goldlight">
                  <MailIcon />
                  <span className="break-all">{CAMPAIGN.email}</span>
                </a>
              </li>
              <li>
                <a href={CAMPAIGN.phoneHref} className="flex items-start gap-2.5 text-paper/80 transition-colors hover:text-goldlight">
                  <PhoneIcon />
                  <span>{CAMPAIGN.phone}</span>
                </a>
              </li>
              <li>
                <address className="flex items-start gap-2.5 not-italic text-paper/75">
                  <PinIcon />
                  <span className="leading-relaxed">
                    {CAMPAIGN.committee}
                    <br />
                    {addressStreet}
                    {addressCity ? (
                      <>
                        <br />
                        {addressCity}
                      </>
                    ) : null}
                  </span>
                </address>
              </li>
            </ul>
            <a
              href={VOTER_LOOKUP}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-goldlight"
            >
              Check your registration
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
          </div>

          {/* Legal & transparency */}
          <div>
            <h3 className="eyebrow text-paper/60">Legal &amp; transparency</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={apex(item.href)} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href={FEC.profileUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  FEC filings ({FEC.committeeId})
                </a>
              </li>
            </ul>
          </div>

          {/* Four Fights Arcade — the live civic games */}
          <div>
            <h3 className="eyebrow text-paper/60">Four Fights Arcade</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {liveGames.map((g) => (
                <li key={g.id}>
                  <Link href={apex(`/games/${g.id}`)} className={linkClass}>
                    {g.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={apex("/games")} className="group mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-goldlight">
                  All games
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Values ribbon — quiet reinforcement of what the campaign stands for */}
        <div className="border-t border-paper/10">
          <ul className="container-page flex flex-wrap items-center gap-x-4 gap-y-1 py-4 text-[11px] uppercase tracking-eyebrow text-paper/45">
            {VALUES.map((value, i) => (
              <li key={value} className="flex items-center gap-4">
                {i > 0 ? <span className="text-goldlight/50" aria-hidden>·</span> : null}
                {value}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom bar — FEC disclaimer made prominent */}
        <div className="border-t border-paper/15 bg-ink/40 backdrop-blur-sm">
          <div className="container-page flex flex-col gap-2 py-6 text-xs text-paper/70 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-paper/85">{CAMPAIGN.paidForBy}</p>
            <p>© {new Date().getFullYear()} {CAMPAIGN.committee}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
