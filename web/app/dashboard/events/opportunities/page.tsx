import Link from "next/link";
import { requireCap } from "@/lib/auth";
import { EVENT_TYPE_LABELS, type EventPriority } from "@/lib/events/types";
import { APPEARANCE_OPPORTUNITIES, OPPORTUNITY_COUNTIES } from "@/lib/events/opportunities";
import { PRIORITY_BADGE } from "@/lib/events/priority";
import { PageHeader, HowTo } from "@/components/dashboard/Notice";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { createEventFromOpportunity } from "../actions";

export const dynamic = "force-dynamic";

const TIERS: EventPriority[] = [1, 2, 3];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ county?: string; tier?: string }> }) {
  await requireCap("manageEvents");
  const { county, tier } = await searchParams;
  const tierNum = tier === "1" || tier === "2" || tier === "3" ? (Number(tier) as EventPriority) : null;
  const rows = APPEARANCE_OPPORTUNITIES
    .filter((o) => (county ? o.county === county : true))
    .filter((o) => (tierNum ? o.priority === tierNum : true))
    .slice()
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)); // P1 first

  return (
    <>
      <Link href="/dashboard/events" className="text-sm text-field underline">← All events</Link>
      <PageHeader kicker="Field" title="Appearance opportunities">
        <span className="font-mono text-sm text-slate">{rows.length}</span>
      </PageHeader>

      <HowTo
        steps={[
          "A starter shortlist of recurring appearances in MO-02 and a few adjacent border counties — fairs, festivals, July 4 parades, and county GOP events — worth considering.",
          "These are public-event listings, not a schedule or an invitation. Click the source to verify this year's dates and whether the campaign can appear.",
          "“Add to calendar” creates a DRAFT event prefilled from the opportunity and opens it — set the real date/time, then publish when confirmed.",
        ]}
      />

      <div className="mb-6 rounded-sm border border-gold/50 bg-gold/10 px-4 py-3 text-sm text-ink">
        <span className="font-semibold">Verify before relying on these.</span>{" "}
        <span className="text-slate">
          Annual dates shift year to year — each entry shows a typical window and a source link, last checked on its
          listed date. Confirm the current date and participation with the organizer. This is educational logistical
          information, not legal advice or a commitment.
        </span>
      </div>

      {(() => {
        // Build a filter URL preserving the other facet.
        const href = (next: { county?: string | null; tier?: string | null }) => {
          const c = next.county === undefined ? county : next.county;
          const t = next.tier === undefined ? (tierNum ? String(tierNum) : null) : next.tier;
          const p = new URLSearchParams();
          if (c) p.set("county", c);
          if (t) p.set("tier", t);
          const q = p.toString();
          return `/dashboard/events/opportunities${q ? `?${q}` : ""}`;
        };
        const chip = (active: boolean) =>
          `rounded-full border px-3 py-1 text-xs ${active ? "border-ink bg-ink text-paper" : "border-line text-slate hover:border-ink"}`;
        return (
          <div className="mb-6 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold text-slate">Priority</span>
              <Link href={href({ tier: null })} className={chip(!tierNum)}>All</Link>
              {TIERS.map((t) => (
                <Link key={t} href={href({ tier: String(t) })} className={chip(tierNum === t)}>P{t}</Link>
              ))}
            </div>
            {OPPORTUNITY_COUNTIES.length > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-semibold text-slate">County</span>
                <Link href={href({ county: null })} className={chip(!county)}>All</Link>
                {OPPORTUNITY_COUNTIES.map((c) => (
                  <Link key={c} href={href({ county: c })} className={chip(county === c)}>{c}</Link>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className="space-y-3">
        {rows.map((o) => (
          <div key={o.slug} className="flex flex-wrap items-start gap-x-4 gap-y-2 rounded-sm border border-line bg-paper p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-sm px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow ${PRIORITY_BADGE[o.priority]}`}>P{o.priority}</span>
                <span className="font-semibold text-ink">{o.name}</span>
                <span className="rounded-sm bg-line px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-eyebrow text-slate">{EVENT_TYPE_LABELS[o.suggestedType]}</span>
              </div>
              <p className="mt-1 text-sm text-slate">{o.blurb}</p>
              <p className="mt-1 text-xs text-slate">
                {[o.city, o.county].filter(Boolean).join(", ")} · {o.cadence} · <span className="text-ink">typically {o.typicalWindow}</span>
                {" · "}
                <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-field underline">source ↗</a>
                <span className="ml-1">(verified {o.verifiedAt})</span>
              </p>
            </div>
            <form action={createEventFromOpportunity} className="shrink-0">
              <input type="hidden" name="slug" value={o.slug} />
              <SubmitButton pendingText="Adding…" className="btn-ghost px-3 py-1.5 text-sm">Add to calendar</SubmitButton>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
