import { LADDER } from "@/lib/donorLadder";

// Supporter levels on /donate — the donor value ladder from
// candidate/donor-value-ladder.md, rendered with WinRed deep links (the
// DonationImpact `&amount=` pattern). Compliance framing per that doc's §3:
// levels are the committee's guaranteed thank-yous ("the committee provides"),
// never a purchase or price; the full contribution counts against FEC limits,
// and the top rungs carry the per-election designation note. The page's
// existing fine-print block (attestation, not-tax-deductible, paid-for-by)
// renders directly below this section.
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

export function DonorLadder({ donateBase }: { donateBase: string }) {
  return (
    <div className="mx-auto mt-14 max-w-3xl">
      <p className="eyebrow text-brick">Supporter levels</p>
      <h2 className="mt-2 text-2xl font-semibold">Every level unlocks a thank-you</h2>
      <p className="mt-2 max-w-prose text-sm text-slate">
        Levels stack with everything you&rsquo;ve given this election cycle — as a thank-you, Matt Grant for
        Congress provides each level&rsquo;s items and invitations. Your full contribution counts toward the
        federal limit of $3,500 per election (2025&ndash;2026).
      </p>
      <ul className="mt-5 divide-y divide-line rounded-lg border border-line shadow-card">
        {LADDER.map((rung) => (
          <li key={rung.amountCents} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
            <span className="w-16 shrink-0 font-display text-lg text-brick">{dollars(rung.amountCents)}</span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-ink">{rung.name}</span>
              <span className="block text-sm text-slate">
                {rung.unlocks}
                {rung.note ? <span className="block text-[0.75rem] italic">{rung.note}</span> : null}
              </span>
            </span>
            <a
              href={`${donateBase}&amount=${rung.amountCents / 100}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost shrink-0 px-3 py-1.5 text-sm"
            >
              Give {dollars(rung.amountCents)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
