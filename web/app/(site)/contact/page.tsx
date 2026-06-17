import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { CAMPAIGN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get involved with Matt Grant for Congress — volunteer, host an event, or reach the campaign.",
};

export default function ContactPage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="max-w-3xl">
        <p className="eyebrow text-brick">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Let's get to work.</h1>
        <p className="mt-5 text-lg text-slate">
          This race is won one neighbor at a time. Tell us how you'd like to help and we'll plug you
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

          <div className="card bg-ink p-8 text-paper">
            <p className="eyebrow text-gold">The fastest way to help</p>
            <h2 className="mt-2 font-display text-2xl font-semibold">Donate today.</h2>
            <p className="mt-2 text-paper/75">Funds doors, calls, and mail before {CAMPAIGN.electionLabel}.</p>
            <a href={CAMPAIGN.donateUrl} target="_blank" rel="noopener noreferrer" className="btn-gold mt-5 w-full">
              Donate on WinRed
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
