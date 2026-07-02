import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CAMPAIGN, ASSETS_CDN } from "@/lib/site";
import { getBudgetItems } from "@/lib/budget/items";
import DonationImpact from "@/components/budget/DonationImpact";

// Public catalog page; the Airtable read is already ISR@60 (listRecords
// revalidate). Make the route's cache window explicit so it's a documented
// guardrail, not an implicit side effect — CloudFront serves it, not the SSR Lambda.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Support Matt Grant for Congress. See exactly what your contribution funds, then give securely through WinRed.",
};

export default async function DonatePage() {
  // Public, read-only catalog (governed by the Front-End Access control table:
  // budget / Items / public / read). Degrades to the offline seed if Airtable is
  // unreachable, so the page never breaks.
  const { items } = await getBudgetItems();

  return (
    <section className="container-page py-16 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="eyebrow text-brick">Chip in</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Fuel the final stretch.</h1>
          <p className="mt-5 max-w-prose text-lg text-slate">
            Every contribution pays for doors knocked, calls made, and neighbors reached before{" "}
            {CAMPAIGN.electionLabel}. Pick an amount below and see exactly what it funds — then give
            securely through WinRed.
          </p>
        </div>
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border border-line shadow-card">
          <Image
            src={`${ASSETS_CDN}/public/marketing/flyers/mg-flyer-solutions-for-missouri-families.png`}
            alt="Solutions for Missouri families"
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
            priority
          />
        </div>
      </div>

      <DonationImpact items={items} donateBase={CAMPAIGN.donateUrl} />

      <div className="mx-auto mt-6 max-w-2xl">
        <p className="text-xs leading-relaxed text-slate">
          By contributing you confirm that this gift is made from your own funds, on a personal card in
          your own name, and that you are a U.S. citizen or lawfully admitted permanent resident. Federal
          law prohibits contributions from corporations, labor unions, federal contractors, and foreign
          nationals.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate">
          Contributions to {CAMPAIGN.committee} are not tax-deductible. Federal law requires us to use
          best efforts to collect and report the name, mailing address, occupation, and employer of
          individuals whose contributions exceed $200 in an election cycle, and contributions over $200
          are reported to and published by the FEC. See our{" "}
          <Link href="/data-policy" className="underline hover:text-brick">
            Data Policy
          </Link>
          . {CAMPAIGN.paidForBy}
        </p>
      </div>
    </section>
  );
}
