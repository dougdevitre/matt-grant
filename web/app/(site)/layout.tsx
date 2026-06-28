import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AskMatt } from "@/components/AskMatt";
import { MobileActionBar } from "@/components/MobileActionBar";
import { clerkEnabled } from "@/lib/auth";
import { CAMPAIGN, SOCIALS, FEC, SITE_URL } from "@/lib/site";

// Organization structured data so the campaign's verified social profiles feed
// search/knowledge-panel results (schema.org `sameAs`). Campaign-level profiles
// only — the candidate's personal page and the advocacy group are excluded — plus
// the authoritative FEC committee record. Driven off the shared SOCIALS list.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: CAMPAIGN.committee,
  url: SITE_URL,
  logo: `${SITE_URL}/brand/logo.png`,
  sameAs: [
    ...SOCIALS.filter((s) => ["x", "facebook", "instagram", "linkedin", "youtube"].includes(s.id)).map((s) => s.url),
    FEC.profileUrl,
  ],
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader clerkEnabled={clerkEnabled} />
      <main id="main">{children}</main>
      <SiteFooter />
      {/* Spacer so the footer clears the fixed mobile action bar. */}
      <div aria-hidden className="h-14 lg:hidden" />
      <MobileActionBar />
      <AskMatt />
    </>
  );
}
