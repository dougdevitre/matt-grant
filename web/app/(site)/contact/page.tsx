import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "@/components/ContactForm";
import { CtaButton } from "@/components/CtaButton";
import { CAMPAIGN, ASSETS_CDN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get involved with Matt Grant for Congress — volunteer, host an event, or reach the campaign.",
};

export default function ContactPage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="max-w-3xl">
        <p className="eyebrow text-brick">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Let&apos;s get to work.</h1>
        <p className="mt-5 text-lg text-slate">
          This race is won one neighbor at a time. Tell us how you&apos;d like to help and we&apos;ll plug you
          in — or reach the campaign directly.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <ContactForm />

        <aside className="space-y-6">
          <div className="card p-8">
            <p className="eyebrow text-slate">Reach the campaign</p>
            <ul className="mt-4 space-y-4">
              <li>
                <span className="block text-sm text-slate">Email</span>
                <a href={`mailto:${CAMPAIGN.email}`} className="font-display text-lg font-semibold text-ink hover:text-brick">
                  {CAMPAIGN.email}
                </a>
              </li>
              <li>
                <span className="block text-sm text-slate">Phone</span>
                <a href={CAMPAIGN.phoneHref} className="font-display text-lg font-semibold text-ink hover:text-brick">
                  {CAMPAIGN.phone}
                </a>
              </li>
              <li>
                <span className="block text-sm text-slate">Mail</span>
                <p className="text-ink">{CAMPAIGN.address}</p>
              </li>
            </ul>
          </div>

          <div className="card relative overflow-hidden bg-ink p-8 text-paper">
            <Image
              src={`${ASSETS_CDN}/public/web/st-louis-arch.png`}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              aria-hidden
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-ink/55" aria-hidden />
            <div className="relative">
              <p className="eyebrow text-goldlight">The fastest way to help</p>
              <h2 className="mt-2 font-display text-2xl font-semibold">Donate today.</h2>
              <p className="mt-2 text-paper/80">Funds doors, calls, and mail before {CAMPAIGN.electionLabel}.</p>
              <CtaButton href={CAMPAIGN.donateUrl} external context="donate" className="btn-gold mt-5 w-full">
                Donate on WinRed
              </CtaButton>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
