import type { Metadata } from "next";
import { CAMPAIGN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Donate",
  description: "Support Matt Grant for Congress. Contribute securely through WinRed.",
};

const AMOUNTS = [25, 50, 100, 250, 500, 1000];

function donateLink(amount?: number) {
  // WinRed reads the amount from its own form; we deep-link to the campaign page.
  const base = CAMPAIGN.donateUrl;
  return amount ? `${base}&amount=${amount}` : base;
}

export default function DonatePage() {
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-brick">Chip in</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Fuel the final stretch.</h1>
        <p className="mt-5 text-lg text-slate">
          Every contribution pays for doors knocked, calls made, and neighbors reached before{" "}
          {CAMPAIGN.electionLabel}. Donations are processed securely through WinRed.
        </p>
      </div>

      <div className="card mx-auto mt-12 max-w-2xl p-8 sm:p-10">
        <p className="eyebrow text-slate">Choose an amount</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AMOUNTS.map((a) => (
            <a
              key={a}
              href={donateLink(a)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center rounded-sm border border-line bg-white py-5 font-display text-2xl font-semibold text-ink transition-colors hover:border-brick hover:bg-brick hover:text-paper"
            >
              ${a}
            </a>
          ))}
        </div>
        <a
          href={donateLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6 w-full"
        >
          Donate another amount on WinRed →
        </a>
        <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-slate">
          Contributions to {CAMPAIGN.committee} are not tax-deductible. Federal law requires us to
          use best efforts to collect and report the name, mailing address, occupation, and employer
          of individuals whose contributions exceed $200 in an election cycle. {CAMPAIGN.paidForBy}
        </p>
      </div>
    </section>
  );
}
