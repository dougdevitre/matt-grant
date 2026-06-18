import Link from "next/link";
import Image from "next/image";
import { CAMPAIGN, NAV } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-ink text-paper">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-md bg-white p-1.5">
              <Image src="/brand/logo.png" alt="Matt Grant for Congress" width={56} height={56} className="h-full w-auto" />
            </span>
            <span className="font-display text-xl font-semibold">Matt Grant for Congress</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-paper/70">
            {CAMPAIGN.tagline} {CAMPAIGN.promise} Election day is {CAMPAIGN.electionLabel}.
          </p>
          <a
            href={CAMPAIGN.donateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold mt-6"
          >
            Donate today
          </a>
        </div>

        <div>
          <h3 className="eyebrow text-paper/60">Campaign</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-paper/80 hover:text-gold">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/dashboard" className="text-paper/80 hover:text-gold">
                Staff sign-in
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="eyebrow text-paper/60">Contact</h3>
          <ul className="mt-4 space-y-2 text-sm text-paper/80">
            <li>
              <a href={`mailto:${CAMPAIGN.email}`} className="hover:text-gold">
                {CAMPAIGN.email}
              </a>
            </li>
            <li>
              <a href={CAMPAIGN.phoneHref} className="hover:text-gold">
                {CAMPAIGN.phone}
              </a>
            </li>
            <li className="text-paper/60">{CAMPAIGN.address}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-paper/15">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-paper/55 sm:flex-row sm:items-center sm:justify-between">
          <p>{CAMPAIGN.paidForBy}</p>
          <p>© {CAMPAIGN.committee}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
