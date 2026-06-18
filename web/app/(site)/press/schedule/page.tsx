import type { Metadata } from "next";
import Link from "next/link";
import { CAMPAIGN, MEDIA } from "@/lib/site";

export const metadata: Metadata = {
  title: "Schedule an interview",
  description: "Schedule a Zoom podcast, phone, or in-person interview with Matt Grant.",
};

const FORMATS = [
  { name: "Zoom podcast", note: "Recorded video call — our most common format." },
  { name: "Phone interview", note: "Quick turnaround for daily news." },
  { name: "In-person", note: "Across MO-02 when Matt is in-district." },
  { name: "Written Q&A", note: "Email your questions; we'll return answers on deadline." },
];

// Placeholder scheduling page. When a live calendar exists, set
// NEXT_PUBLIC_MEDIA_BOOKING_URL (Calendly/Cal.com/Zoom) — the press kit will
// link straight to it — or drop the embed into the marked slot below.
export default function SchedulePage() {
  const hasCalendar = Boolean(MEDIA.bookingUrl) && MEDIA.bookingUrl !== "/press/schedule";
  const mailto = `mailto:${MEDIA.email}?subject=${encodeURIComponent("Interview request")}&body=${encodeURIComponent(
    "Outlet: \nFormat (Zoom podcast / phone / in-person / written): \nTopic / angle: \n\nA few times that work on my end:\n - \n",
  )}`;

  return (
    <section className="container-page py-16 sm:py-24">
      <p className="eyebrow text-brick">Media</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Schedule an interview.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Matt makes time for the press. Pick a format, send a couple of windows that work for you, and
        we&apos;ll confirm quickly — usually the same day.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {FORMATS.map((f) => (
          <div key={f.name} className="card p-5">
            <p className="font-display text-lg font-semibold text-ink">{f.name}</p>
            <p className="mt-1 text-sm text-slate">{f.note}</p>
          </div>
        ))}
      </div>

      {/* Calendar slot — Calendly/Cal.com embed drops in here when configured. */}
      <div className="mt-10">
        {hasCalendar ? (
          <a href={MEDIA.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Open the booking calendar ↗
          </a>
        ) : (
          <div className="card border-dashed p-6">
            <p className="eyebrow text-slate">Live calendar — coming soon</p>
            <p className="mt-2 max-w-prose text-sm text-slate">
              Online self-scheduling isn&apos;t live yet. In the meantime, email the campaign with your
              outlet, preferred format, and a few times — we&apos;ll lock it in.
            </p>
            <a href={mailto} className="btn-ink mt-4 inline-block">
              Email to schedule
            </a>
          </div>
        )}
      </div>

      <p className="mt-8 text-sm text-slate">
        Prefer to come prepared?{" "}
        <Link href="/press" className="font-semibold text-ink underline-offset-2 hover:underline">
          Generate suggested interview questions
        </Link>{" "}
        on the press page first.
      </p>

      <p className="mt-10 border-t border-line pt-5 text-xs text-slate">{CAMPAIGN.paidForBy}</p>
    </section>
  );
}
