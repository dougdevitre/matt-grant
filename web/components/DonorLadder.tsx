import { LADDER } from "@/lib/donorLadder";

// Supporter levels on /donate as a COMPARISON module — one card per level in a
// responsive grid, "Everything in [previous], plus:" so the stacking reads at a
// glance. Built from the same site primitives as the rest of the page (card,
// grid utilities, eyebrow, btn-*) and derived entirely from lib/donorLadder's
// LADDER so copy can't drift from candidate/donor-value-ladder.md. Compliance
// framing per that doc's §3: levels are the committee's guaranteed thank-yous
// ("the committee provides"), never a purchase or price; the full contribution
// counts against FEC limits, and the top rungs carry the designation note. The
// page's existing fine-print block (attestation, not-tax-deductible,
// paid-for-by) renders directly below this section.
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

export function DonorLadder({ donateBase }: { donateBase: string }) {
  return (
    <div className="mx-auto mt-14 max-w-6xl">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow text-brick">Supporter levels</p>
        <h2 className="mt-2 text-2xl font-semibold">Every level unlocks a thank-you</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-slate">
          Levels stack with everything you&rsquo;ve given this election cycle — as a thank-you, Matt Grant for
          Congress provides each level&rsquo;s items and invitations. Your full contribution counts toward the
          federal limit of $3,500 per election (2025&ndash;2026).
        </p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LADDER.map((rung, i) => {
          const prev = i > 0 ? LADDER[i - 1] : null;
          const top = i >= LADDER.length - 2; // the two FEC-max rungs
          return (
            <li
              key={rung.amountCents}
              className={`card flex flex-col p-5 ${top ? "border-brick/40" : ""}`}
            >
              <p className="font-display text-2xl text-brick">{dollars(rung.amountCents)}</p>
              <p className="mt-0.5 font-semibold text-ink">{rung.name}</p>
              {rung.note && <p className="mt-1 text-[0.7rem] italic leading-snug text-slate">{rung.note}</p>}

              <ul className="mt-3 flex-1 space-y-1.5 text-sm text-slate">
                {prev && (
                  <li className="font-medium text-ink">
                    Everything in {prev.name}, <span className="text-brick">plus:</span>
                  </li>
                )}
                {rung.unlocks.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="mt-0.5 shrink-0 text-field">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`${donateBase}&amount=${rung.amountCents / 100}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${top ? "btn-primary" : "btn-ghost"} mt-4 w-full px-3 py-2 text-center text-sm`}
              >
                Give {dollars(rung.amountCents)}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
