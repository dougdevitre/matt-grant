"use client";

import { useState } from "react";
import { MEDIA } from "@/lib/site";
import type { TopicCluster } from "@/lib/pressTopics";

const FORMATS = ["Zoom podcast", "Phone interview", "In-person", "Written Q&A"] as const;

export function PressKit() {
  const [outlet, setOutlet] = useState("");
  const [focus, setFocus] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]>("Zoom podcast");
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"ai" | "curated" | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/press/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outlet, focus }),
      });
      const data = await res.json();
      setClusters(data.clusters ?? []);
      setSource(data.source ?? "curated");
    } catch {
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle(q: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  }

  const chosen = clusters.flatMap((c) => c.questions).filter((q) => picked.has(q));

  function bookingHref() {
    const lines = [
      `Outlet: ${outlet || "(your outlet)"}`,
      `Preferred format: ${format}`,
      focus ? `Angle: ${focus}` : "",
      "",
      chosen.length ? "Questions I'd like to cover:" : "",
      ...chosen.map((q, i) => `${i + 1}. ${q}`),
      "",
      "A few times that work on my end:",
      " - ",
    ].filter(Boolean);
    const body = encodeURIComponent(lines.join("\n"));
    const subject = encodeURIComponent(`Interview request — ${outlet || "media"} (${format})`);
    return `mailto:${MEDIA.email}?subject=${subject}&body=${body}`;
  }

  const copyChosen = () => navigator.clipboard?.writeText(chosen.join("\n"));

  return (
    <div className="card mt-8 p-6 sm:p-8">
      <p className="eyebrow text-brick">For the press</p>
      <h3 className="mt-2 font-display text-2xl font-semibold">Book Matt — and walk in with your questions ready.</h3>
      <p className="mt-2 max-w-prose text-sm text-slate">
        Tell us your outlet and angle. We&apos;ll suggest interview topics and sample questions grounded in
        Matt&apos;s platform, you pick the ones you want, and we&apos;ll carry them straight into the booking.
      </p>

      {/* Inputs */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Outlet / show</span>
          <input
            value={outlet}
            onChange={(e) => setOutlet(e.target.value)}
            placeholder="e.g. KSDK, The Unknown Podcast"
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as (typeof FORMATS)[number])}
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          >
            {FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-ink">Your angle (optional)</span>
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. family-court reform, term limits, the new MO-02 map"
            className="mt-1 w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={generate} disabled={loading} className="btn-ink disabled:opacity-60">
          {loading ? "Generating…" : "Suggest questions with AI"}
        </button>
        {source && (
          <span className="text-xs text-slate">
            {source === "ai" ? "Tailored to your angle." : "Suggested from Matt's platform."}
          </span>
        )}
      </div>

      {/* Topic clusters */}
      {clusters.length > 0 && (
        <div className="mt-6 space-y-5">
          {clusters.map((c) => (
            <div key={c.topic} className="border-t border-line pt-4">
              <p className="font-display text-lg font-semibold text-ink">{c.topic}</p>
              {c.angle && <p className="mt-0.5 text-xs text-slate">{c.angle}</p>}
              <ul className="mt-3 space-y-2">
                {c.questions.map((q) => (
                  <li key={q}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={picked.has(q)}
                        onChange={() => toggle(q)}
                        className="mt-1 accent-brick"
                      />
                      <span>{q}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Action bar */}
          <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-sm border border-line bg-paper/95 p-3 backdrop-blur">
            <span className="text-xs font-semibold text-ink">
              {chosen.length} question{chosen.length === 1 ? "" : "s"} selected
            </span>
            <button onClick={copyChosen} disabled={!chosen.length} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50">
              Copy selected
            </button>
            {MEDIA.bookingUrl ? (
              <a href={MEDIA.bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                Schedule a time ↗
              </a>
            ) : null}
            <a href={bookingHref()} className="btn-gold">
              {MEDIA.bookingUrl ? "Email the campaign" : "Request this interview"}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
