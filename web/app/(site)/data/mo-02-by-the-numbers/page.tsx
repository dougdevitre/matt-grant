import type { Metadata } from "next";
import Link from "next/link";
import { Figure } from "@/components/data/Figure";
import { DEMOGRAPHICS_SOURCE } from "@/lib/demographics/schema";

export const metadata: Metadata = {
  title: "MO-02 by the numbers",
  description:
    "The data behind Children First: the St. Louis region — and MO-02 — is losing children and aging fast. U.S. Census Bureau 2025 estimates.",
};

export default function ByTheNumbersPage() {
  return (
    <>
      <section className="bg-ink text-paper">
        <div className="container-page py-14 sm:py-20">
          <p className="eyebrow text-goldlight">The case for Children First</p>
          <h1 className="mt-2 max-w-4xl text-4xl font-semibold sm:text-6xl">MO-02 by the numbers</h1>
          <p className="mt-4 max-w-prose text-lg text-paper/80">
            Fewer children are growing up in our district, and our region is aging faster than most of
            the country. These aren&apos;t projections — they&apos;re the latest U.S. Census Bureau
            estimates. They&apos;re why <Link href="/issues/family-courts" className="underline">putting
            children first</Link> is the fight this campaign leads with.
          </p>
        </div>
      </section>

      <div className="container-page py-12 sm:py-16">
        {/* MO-02 first */}
        <section>
          <p className="eyebrow text-brick">Our district</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">The child population is shrinking across MO-02</h2>
          <p className="mt-3 max-w-prose text-slate">
            Between 2020 and 2025, the number of children under 15 fell across MO-02&apos;s core counties —
            St. Louis County (of which MO-02 holds the western/central part) dropped 5.9% and Jefferson
            County 5.6%. Those are the two MO-02 counties captured in this St. Louis-metro dataset; the
            district&apos;s three rural counties — Washington, Crawford, and Gasconade — sit outside it.
          </p>
          <Figure id="mo02-child-under15" />
        </section>

        {/* Metro context */}
        <section className="mt-12 border-t border-line pt-10">
          <p className="eyebrow text-brick">The St. Louis region</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">A regional and national outlier</h2>
          <p className="mt-3 max-w-prose text-slate">
            The decline isn&apos;t just local. Among the 50 largest U.S. metros, St. Louis has one of the
            steepest drops in young children in the country — and its population is aging into a
            senior-heavy structure.
          </p>
          <Figure id="under5-metro-ranking" />
          <Figure id="stcharles-age-structure" />
          <Figure id="msa-age-series" />
        </section>

        {/* National context */}
        <section className="mt-12 border-t border-line pt-10">
          <p className="eyebrow text-brick">National context</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-ink">Among the oldest large metros</h2>
          <Figure id="aging-index-metro" />
        </section>

        <section className="mt-12 border-t border-line pt-10">
          <h2 className="font-display text-xl font-semibold text-ink">Why this matters</h2>
          <p className="mt-3 max-w-prose text-slate">
            Today&apos;s decline in children becomes tomorrow&apos;s smaller schools, workforce, and
            communities. Reversing it means making MO-02 a place where families can afford to put down
            roots and raise kids. That is the heart of{" "}
            <Link href="/issues/family-courts" className="text-field underline">Children First and the CHILD Protection Act</Link>.
          </p>
          <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-eyebrow text-slate">
            Source for every figure on this page: {DEMOGRAPHICS_SOURCE}. Figures are county- and
            metro-level Census estimates. Under the 2025 map, MO-02 is St. Louis County (part),
            Jefferson, Washington, Crawford, and Gasconade; only St. Louis County and Jefferson appear
            in this St. Louis-metro dataset.
          </p>
        </section>
      </div>
    </>
  );
}
