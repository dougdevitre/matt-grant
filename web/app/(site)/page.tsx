import Link from "next/link";
import Image from "next/image";
import { Countdown } from "@/components/Countdown";
import { Reveal } from "@/components/Reveal";
import { HeroVideo } from "@/components/HeroVideo";
import { CtaButton } from "@/components/CtaButton";
import { CAMPAIGN, PRIORITIES, VALUES, ASSETS_CDN } from "@/lib/site";

export default function HomePage() {
  return (
    <>
      {/* HERO — the thesis: conviction + the clock */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <HeroVideo />
        {/* Scrim: darkest on the left where the headline sits, clearing toward the right so the video reads */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/45" aria-hidden />
        <div className="absolute inset-0 bg-ink/30" aria-hidden />
        <div className="absolute inset-0 bg-grid opacity-[0.35] mix-blend-soft-light" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brick via-paper to-field" aria-hidden />
        <div className="container-page relative grid gap-14 py-20 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="animate-rise-in">
            <p className="eyebrow text-goldlight">{CAMPAIGN.committee} · {CAMPAIGN.district}</p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
              Put Missouri&apos;s{" "}
              <span className="text-goldlight">children</span> first.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-paper/80">
              Matt Grant is a neighbor, a dad, and a problem-solver. Twenty-five years practicing
              law as a litigator taught him how to bring people together and get results — and he&apos;s running
              for Congress to do exactly that.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/sign-up" className="btn-primary">
                Join the community
              </Link>
              <CtaButton href={CAMPAIGN.donateUrl} external context="donate" className="btn-gold">
                Donate now
              </CtaButton>
              <Link href="/about" className="btn-ghost border-paper/30 text-paper hover:border-paper">
                Meet Matt
              </Link>
            </div>
          </div>

          <div className="card animate-rise-in bg-field/40 p-8 backdrop-blur ring-1 ring-paper/10">
            <p className="eyebrow text-paper/70">Election day · primary</p>
            <p className="mt-1 font-display text-2xl font-semibold text-paper">
              {CAMPAIGN.electionLabel}
            </p>
            <div className="mt-6">
              <Countdown iso={CAMPAIGN.electionDate} />
            </div>
            <p className="mt-6 border-t border-paper/15 pt-4 text-sm text-paper/70">
              &ldquo;Matt does not just talk — he takes action.&rdquo; Every day on this clock is a day to
              reach one more neighbor.
            </p>
          </div>
        </div>
      </section>

      {/* VALUES strip */}
      <section className="border-b border-line bg-white">
        <div className="container-page flex flex-wrap items-center gap-x-8 gap-y-3 py-5">
          <span className="eyebrow text-slate">What guides this campaign</span>
          {VALUES.map((v) => (
            <span key={v} className="star font-display text-lg text-ink">
              {v}
            </span>
          ))}
        </div>
      </section>

      {/* PRIORITIES — the ledger */}
      <section className="container-page py-20 sm:py-24">
        <div className="max-w-prose">
          <p className="eyebrow text-brick">The platform</p>
          <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Four priorities worth standing for.</h2>
          <p className="mt-4 text-lg text-slate">
            Not a wish list — a docket. Each one is concrete, accountable, and built for results
            across the aisle.
          </p>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2">
          {PRIORITIES.map((p, i) => (
            <li key={p.id} className="group bg-white transition-colors hover:bg-paper">
              <Link href={`/issues/${p.id}`} className="block h-full">
                <Reveal delay={i * 80} className="h-full p-8">
                  <div className="flex items-baseline gap-4">
                    <span className="font-mono text-sm text-gold">{p.n}</span>
                    <h3 className="font-display text-2xl font-semibold leading-snug text-ink group-hover:text-brick">
                      {p.title}
                    </h3>
                  </div>
                  <p className="mt-4 text-slate">{p.summary}</p>
                  <p className="mt-4 font-mono text-xs uppercase tracking-eyebrow text-field">{p.short} →</p>
                </Reveal>
              </Link>
            </li>
          ))}
        </ol>

        <div className="mt-8">
          <Link href="/issues" className="btn-ghost">
            Explore all four issues →
          </Link>
        </div>
      </section>

      {/* FOUR FIGHTS infographic */}
      <section className="border-y border-line bg-paper">
        <div className="container-page py-14 sm:py-16">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-line bg-white shadow-card">
            <Image
              src={`${ASSETS_CDN}/public/marketing/infographic.png`}
              alt="The Four Fights — Matt Grant's platform at a glance"
              fill
              sizes="(max-width: 1024px) 100vw, 1100px"
              className="object-contain"
            />
          </div>
        </div>
      </section>

      {/* MEET MATT band */}
      <section className="bg-ink text-paper">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="relative">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg ring-1 ring-paper/10">
              <Image
                src="/brand/portrait-800.png"
                alt="Matt Grant"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
                priority
              />
            </div>
            <span className="absolute -bottom-4 -right-3 rounded-sm bg-gold px-4 py-2 font-mono text-xs uppercase tracking-eyebrow text-paper">
              Eagle Scout · Dad · Litigator
            </span>
          </div>
          <div>
            <p className="eyebrow text-goldlight">Meet Matt</p>
            <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">
              From three public schools to 25 years practicing law as a litigator — and now, public service.
            </h2>
            <p className="mt-5 text-lg text-paper/80">
              Matt learned the value of hard work, integrity, and community early — earning the rank
              of Eagle Scout in the Boy Scouts of America. As an Equity Partner at Husch Blackwell,
              he built teams that delivered efficient results for Missouri&apos;s families and businesses.
              In Congress, he&apos;ll work across the aisle to get things done.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/about" className="btn-gold">Matt&apos;s full story</Link>
              <Link href="/contact" className="btn-ghost border-paper/30 text-paper hover:border-paper">
                Volunteer
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CAMPAIGN HQ — member sign-in band */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <div className="absolute inset-x-0 top-0 flex h-1" aria-hidden>
          <span className="h-full w-2/5 bg-brick" /><span className="h-full w-1/5 bg-paper" /><span className="h-full w-2/5 bg-field" />
        </div>
        <div className="container-page py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow text-goldlight">Campaign HQ · by invitation</p>
            <h2 className="mt-3 text-4xl font-semibold sm:text-5xl">Where the team works together.</h2>
            <p className="mt-4 text-lg text-paper/80">
              Sign in to the Peace Room — the campaign&apos;s collaborative hub, where the team and coalition
              partners run fundraising, field, volunteers, and strategy to restore public trust in MO-02.
            </p>
          </div>

          <ul className="mt-12 grid gap-px overflow-hidden rounded-lg bg-paper/10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["◈", "Fundraising & donors", "Log contributions and stay FEC-clean."],
              ["▦", "Finance & compliance", "Cash on hand, spending, filing calendar."],
              ["◎", "3D field map & targets", "Precinct turnout map + ranked GOTV targets."],
              ["✶", "Volunteer & task hub", "Organize the team and the to-do list."],
              ["❖", "Graphics & asset studio", "Generate on-brand assets on demand."],
              ["⚖", "Opp research & strategy", "The record and the plan to win MO-02."],
            ].map(([icon, title, copy]) => (
              <li key={title} className="bg-ink p-6 transition-colors hover:bg-field/25">
                <span className="font-mono text-2xl text-goldlight" aria-hidden>{icon}</span>
                <p className="mt-3 font-display text-lg font-semibold">{title}</p>
                <p className="mt-1 text-sm text-paper/70">{copy}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/sign-in" className="btn-gold">Sign in to HQ</Link>
            <span className="text-sm text-paper/60">Campaign staff &amp; members · access by invitation.</span>
          </div>
        </div>
      </section>

      {/* CLOSING CTA — full-bleed district band */}
      <section className="relative overflow-hidden bg-ink text-paper">
        <Image
          src={`${ASSETS_CDN}/public/web/st-louis-arch.png`}
          alt=""
          fill
          sizes="100vw"
          aria-hidden
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/85 to-ink/55" aria-hidden />
        <div className="container-page relative py-24 text-center sm:py-32">
          <p className="eyebrow text-goldlight">Join the effort</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold sm:text-5xl">
            This race is decided one neighbor at a time.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-paper/80">
            Join the community in 30 seconds — with your email or a social account — and get the case for
            change, ways to help, and updates from the campaign. Then chip in if you can.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/sign-up" className="btn-primary">Join the community</Link>
            <CtaButton href={CAMPAIGN.donateUrl} external context="donate" className="btn-gold">
              Donate now
            </CtaButton>
          </div>
        </div>
      </section>
    </>
  );
}
