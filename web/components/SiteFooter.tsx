import Link from "next/link";
import Image from "next/image";
import { CAMPAIGN, NAV_LINKS, LEGAL, mainHref } from "@/lib/site";

// Server component (no host at render time), so footer links to the main site are
// always absolute to the apex. That's correct on every pillar subdomain and on the
// apex itself; footers don't need client-side SPA nav, so the full-load is fine.
const apex = (path: string) => mainHref(path, true);

// The committee address is one canonical string in lib/site.ts. Split it at the PMB
// boundary so the mailing block renders on two readable lines without re-typing (and
// risking drift from) the source of truth.
const [addressStreet, addressCity] = CAMPAIGN.address.split(/, (?=PMB)/);

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

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-paper">
      {/* Tricolor banner edge — mirrors the hero's top rule */}
      <div className="h-1 w-full bg-gradient-to-r from-brick via-paper to-field" aria-hidden />

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
        <div className="container-page grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1.1fr_1fr]">
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
              <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-gold">
                Donate today
              </a>
              <Link href={apex("/act")} className="btn-ghost border-paper/30 text-paper hover:border-paper">
                Get involved
              </Link>
            </div>
          </div>

          {/* Campaign nav */}
          <div>
            <h3 className="eyebrow text-paper/60">Campaign</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={apex(item.href)} className="text-paper/80 transition-colors hover:text-goldlight">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={apex("/dashboard")} className="text-paper/80 transition-colors hover:text-goldlight">
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
          </div>

          {/* Legal & transparency */}
          <div>
            <h3 className="eyebrow text-paper/60">Legal &amp; transparency</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link href={apex(item.href)} className="text-paper/80 transition-colors hover:text-goldlight">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
