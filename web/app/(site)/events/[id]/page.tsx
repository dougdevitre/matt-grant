import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, toPublicEvent } from "@/lib/events";
import { EVENT_TYPE_LABELS } from "@/lib/events/types";
import { formatEventRange } from "@/lib/events/time";
import { CAMPAIGN } from "@/lib/site";
import { RsvpForm } from "@/components/site/RsvpForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const e = await getEvent(id);
  if (!e || e.status !== "PUBLISHED") return { title: "Event" };
  return {
    title: e.title,
    description: `${EVENT_TYPE_LABELS[e.type]} · ${formatEventRange(e.start, e.end)} · ${e.location.city || "MO-02"}. RSVP to join ${CAMPAIGN.candidate}.`,
  };
}

export default async function PublicEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await getEvent(id);
  if (!raw || raw.status !== "PUBLISHED") notFound();
  const e = toPublicEvent(raw);
  const where = [e.location.name, e.location.address, e.location.city].filter(Boolean).join(", ");

  return (
    <section className="container-page py-16 sm:py-24">
      <Link href="/events" className="font-mono text-xs text-field underline">← All events</Link>
      <p className="mt-6 font-mono text-xs uppercase tracking-eyebrow text-gold">{EVENT_TYPE_LABELS[e.type]}</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-semibold sm:text-5xl">{e.title}</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <dl className="space-y-3 text-lg">
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 font-mono text-xs uppercase tracking-eyebrow text-slate">When</dt>
              <dd className="text-ink">{formatEventRange(e.start, e.end)}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-24 shrink-0 font-mono text-xs uppercase tracking-eyebrow text-slate">Where</dt>
              <dd className="text-ink">{where || "Location to be announced"}</dd>
            </div>
          </dl>

          {e.description && <p className="mt-6 max-w-prose whitespace-pre-wrap text-lg text-slate">{e.description}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a href={`/api/events/${e.id}/calendar.ics`} className="btn-ghost text-sm">Add to calendar</a>
            {e.goingCount > 0 && <span className="text-sm text-slate">{e.goingCount} neighbor{e.goingCount === 1 ? "" : "s"} going</span>}
          </div>
        </div>

        <div>
          <RsvpForm eventId={e.id} />
        </div>
      </div>
    </section>
  );
}
