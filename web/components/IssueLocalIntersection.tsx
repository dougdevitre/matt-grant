"use client";

import { useState } from "react";
import { CAMPAIGN } from "@/lib/site";
import type { LocalSnapshot } from "@/lib/issues/localSnapshot";

// Local Issue Intersection — the visitor enters a ZIP and sees VERIFIED, CITED
// public data for their area (Layer A), next to Matt's DOCUMENTED commitment on
// this issue (verbatim, static — never generated). It then hands off to the
// existing IssueActionPlan for a personalized plan.
//
// COMPLIANCE: this component generates NO prose. The "what this means" panel is the
// issue's documented `commitment` passed in as a prop. AI-personalized response
// ("how Matt might respond" tuned to the local figures) is a LATER, gated phase —
// it does not live here. See web/docs/local-intersection/SPEC.md.
const input = "mt-1 rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink";
const DISCLAIMER = `For education and civic engagement only — not legal advice. ${CAMPAIGN.paidForBy}`;

export function IssueLocalIntersection({
  issueSlug,
  issueLabel,
  commitment,
  aiEnabled = false,
}: {
  issueSlug: string;
  issueLabel: string;
  commitment: string;
  // When false (default / flag OFF) the panel shows Matt's verbatim documented
  // commitment — today's behavior. When true, it shows the guard-validated
  // generated note. Server passes localResponseEnabled(); dark until sign-off.
  aiEnabled?: boolean;
}) {
  const [zip, setZip] = useState("");
  const [snapshot, setSnapshot] = useState<LocalSnapshot | null>(null);
  const [response, setResponse] = useState<{ paragraphs: string[] } | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function look() {
    if (zip.length !== 5) return;
    setLoading(true);
    setErr("");
    setResponse(null);
    try {
      const r = await fetch("/api/issues/local-snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueSlug, zip }),
      });
      if (!r.ok) throw new Error("rate");
      const { snapshot } = (await r.json()) as { snapshot: LocalSnapshot | null };
      setSnapshot(snapshot);
      setChecked(true);

      // Only when enabled: fetch the generated note. The route returns null while
      // the flag is off, so this is a no-op in production until go-live.
      if (aiEnabled) {
        try {
          const rr = await fetch("/api/issues/local-response", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ issueSlug, zip }),
          });
          if (rr.ok) {
            const { response } = (await rr.json()) as { response: { paragraphs: string[] } | null };
            setResponse(response);
          }
        } catch {
          /* leave response null → panel shows the documented commitment */
        }
      }
      // Carry the ZIP into IssueActionPlan (shares the act:prefs contract).
      try {
        const prefs = JSON.parse(localStorage.getItem("act:prefs") || "{}");
        localStorage.setItem("act:prefs", JSON.stringify({ ...prefs, zip }));
      } catch {
        /* ignore */
      }
    } catch {
      setErr("Couldn't pull local data just now — please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const source = snapshot?.facts[0];

  return (
    <div className="card p-6 sm:p-8">
      <p className="eyebrow text-brick">How this lands where you live</p>
      <h2 className="mt-2 font-display text-2xl font-semibold text-ink">See your area&rsquo;s data on {issueLabel.toLowerCase()}</h2>
      <p className="mt-2 max-w-prose text-sm text-slate">
        Enter your ZIP to see verified public data for your area, alongside Matt&rsquo;s documented
        commitment on this issue. Every figure is sourced; nothing about your local officials or
        institutions is invented.
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink">Your ZIP</span>
          <input
            value={zip}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
              setChecked(false);
              setSnapshot(null);
            }}
            placeholder="63017"
            className={`${input} w-28`}
          />
        </label>
        <button onClick={look} disabled={loading || zip.length !== 5} className="btn-primary disabled:opacity-50">
          {loading ? "Looking…" : "See local data"}
        </button>
      </div>
      {err && <p className="mt-3 text-xs text-brick">{err}</p>}

      {checked && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {/* Layer A — verified, cited local figures */}
          <div className="rounded-sm border border-line bg-white p-5">
            <p className="font-mono text-xs uppercase tracking-eyebrow text-slate">
              {snapshot ? snapshot.place : `ZIP ${zip}`}
            </p>
            {snapshot && snapshot.facts.length > 0 ? (
              <>
                <dl className="mt-3 space-y-3">
                  {snapshot.facts.map((f) => (
                    <div key={f.key}>
                      <dt className="text-xs text-slate">{f.label}</dt>
                      <dd className="font-display text-xl font-semibold text-ink">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                {source && (
                  <p className="mt-4 text-[11px] text-slate">
                    Source:{" "}
                    <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
                      {source.source}
                    </a>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-slate">
                There isn&rsquo;t a specific local figure that changes the case for this issue — it&rsquo;s
                decided at the federal level. Matt&rsquo;s commitment still applies everywhere in {CAMPAIGN.districtShort}.
              </p>
            )}
          </div>

          {/* When enabled, the guard-validated generated note; otherwise Matt's
              verbatim documented commitment (today's behavior). */}
          <div className="rounded-sm border border-line bg-paper p-5">
            {response && response.paragraphs.length > 0 ? (
              <>
                <p className="eyebrow text-gold">How this lands for you</p>
                <div className="mt-3 space-y-3">
                  {response.paragraphs.map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-ink">{p}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow text-gold">Matt&rsquo;s documented commitment</p>
                <p className="mt-3 text-sm leading-relaxed text-ink">{commitment}</p>
              </>
            )}
            <a href="#make-your-plan" className="mt-5 inline-block font-mono text-xs uppercase tracking-eyebrow text-field hover:text-ink">
              Now make your plan for your area ↓
            </a>
          </div>
        </div>
      )}

      {checked && <p className="mt-5 border-t border-line pt-3 text-xs text-slate">{DISCLAIMER}</p>}
    </div>
  );
}
