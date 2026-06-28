"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CAMPAIGN, SITE_URL, ASSETS_CDN, VOTER_LOOKUP } from "@/lib/site";

// "Ask Matt" — a GOTV companion on every public page. Embodies Matt's
// "don't just talk, take action" philosophy: schedule your vote, bring three
// voters, and multiply. No fabricated facts — just the verified date + official
// MO voter lookup + share tools.

const POLLING_LOOKUP = VOTER_LOOKUP;
const AVATAR = `${ASSETS_CDN}/public/brand/avatar-circle.png`;

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Matt Grant for Congress//Vote//EN",
  "BEGIN:VEVENT",
  "UID:vote-aug4-2026@mattgrantforcongress.org",
  "DTSTAMP:20260618T120000Z",
  "DTSTART;VALUE=DATE:20260804",
  "DTEND;VALUE=DATE:20260805",
  "SUMMARY:Vote — Matt Grant, MO-02 Primary",
  `DESCRIPTION:Polls are open today. Vote in Missouri's 2nd District primary. Find your polling place: ${POLLING_LOOKUP}`,
  `URL:${SITE_URL}`,
  "BEGIN:VALARM",
  "TRIGGER:-P1D",
  "ACTION:DISPLAY",
  "DESCRIPTION:Tomorrow is election day — make your plan to vote for Matt Grant.",
  "END:VALARM",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function downloadIcs() {
  const blob = new Blob([ICS], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vote-matt-grant-aug-4.ics";
  a.click();
  URL.revokeObjectURL(url);
}

const inviteMsg = (name: string) =>
  `${name ? name + ", " : ""}I'm voting for Matt Grant in the August 4 primary (Missouri's 2nd District) — a neighbor, a dad, and a problem-solver putting kids first. Will you vote too? ${SITE_URL}`;

const shareMsg = `I just made my plan to vote for Matt Grant on August 4 — and I'm bringing three friends. Join me: ${SITE_URL}`;

export function AskMatt() {
  const [open, setOpen] = useState(false);
  const [pledged, setPledged] = useState(false);
  const [friends, setFriends] = useState(["", "", ""]);
  const [copied, setCopied] = useState<string | null>(null);
  const [seen, setSeen] = useState(true); // default true to avoid an SSR pulse flash
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPledged(localStorage.getItem("mg_pledged") === "1");
    setSeen(localStorage.getItem("mg_askmatt_seen") === "1");
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    if (!seen) {
      setSeen(true);
      localStorage.setItem("mg_askmatt_seen", "1");
    }
  }

  function pledge() {
    setPledged(true);
    localStorage.setItem("mg_pledged", "1");
  }
  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const committed = friends.filter((f) => f.trim()).length;

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label="Ask Matt — make your plan to vote"
        data-hide-on-drawer
        className="fixed bottom-[76px] right-5 z-50 flex items-center gap-2 rounded-full border border-paper/20 bg-ink py-2 pl-2 pr-4 text-paper shadow-card transition-transform hover:scale-[1.03] motion-reduce:transition-none lg:bottom-5"
      >
        {!seen && !open && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brick opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-brick" />
          </span>
        )}
        <Image src={AVATAR} alt="" width={32} height={32} className="h-8 w-8 rounded-full" />
        <span className="text-sm font-semibold">{open ? "Close" : "Ask Matt"}</span>
      </button>

      {open && (
        <>
          {/* click-outside catcher (transparent) */}
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} data-hide-on-drawer className="fixed inset-0 z-40 cursor-default" />
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Ask Matt"
          tabIndex={-1}
          data-hide-on-drawer
          className="fixed bottom-[136px] right-5 z-50 flex max-h-[80vh] w-[min(92vw,360px)] flex-col overflow-hidden rounded-lg border border-line bg-paper shadow-card outline-none motion-safe:animate-rise-in lg:bottom-20"
        >
          {/* header */}
          <div className="relative shrink-0 bg-ink px-5 py-4 text-paper">
            <div className="absolute inset-x-0 top-0 flex h-1" aria-hidden>
              <span className="h-full w-2/5 bg-brick" /><span className="h-full w-1/5 bg-paper" /><span className="h-full w-2/5 bg-field" />
            </div>
            <div className="mt-1 flex items-center gap-3">
              <Image src={AVATAR} alt="Matt Grant" width={40} height={40} className="h-10 w-10 rounded-full" />
              <div>
                <p className="font-display text-base font-semibold">Ask Matt</p>
                <p className="text-xs text-paper/70">Don&apos;t just talk — take action.</p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* 1 — schedule */}
            <section>
              <p className="eyebrow text-brick">1 · Schedule your vote</p>
              <p className="mt-1 text-sm text-slate">The primary is <strong className="text-ink">{CAMPAIGN.electionLabel}</strong>. Lock it in.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={pledge} disabled={pledged} className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${pledged ? "bg-field/15 text-field" : "btn-primary"}`}>
                  {pledged ? "✓ I'm voting" : "I'll vote Aug 4"}
                </button>
                <button onClick={downloadIcs} className="btn-ghost px-3 py-1.5 text-xs">Add to calendar</button>
                <a href={POLLING_LOOKUP} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Find my polling place ↗</a>
              </div>
            </section>

            {/* 2 — bring three */}
            <section className="border-t border-line pt-5">
              <p className="eyebrow text-brick">2 · Bring three voters</p>
              <p className="mt-1 text-sm text-slate">Name three people you&apos;ll get to the polls, then send each a nudge.</p>
              <div className="mt-3 space-y-2">
                {friends.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={f}
                      onChange={(e) => setFriends((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={`Friend ${i + 1}`}
                      className="min-w-0 flex-1 rounded-sm border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-ink"
                    />
                    <a
                      href={`sms:?&body=${encodeURIComponent(inviteMsg(f.trim()))}`}
                      className="shrink-0 rounded-sm border border-line px-2.5 py-1.5 text-xs font-semibold text-field hover:border-ink"
                    >Text</a>
                    <button
                      onClick={() => copy(inviteMsg(f.trim()), `f${i}`)}
                      className="shrink-0 rounded-sm border border-line px-2 py-1.5 text-xs text-slate hover:border-ink"
                    >{copied === `f${i}` ? "✓" : "Copy"}</button>
                  </div>
                ))}
              </div>
              {committed > 0 && <p className="mt-2 text-xs text-field">{committed} of 3 lined up — that&apos;s how we win.</p>}
            </section>

            {/* 3 — multiply */}
            <section className="border-t border-line pt-5">
              <p className="eyebrow text-brick">3 · Multiply it</p>
              <p className="mt-1 text-sm text-slate">Ask them to bring three more. Share your plan:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Share to X</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}&quote=${encodeURIComponent(shareMsg)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost px-3 py-1.5 text-xs">Share to FB</a>
                <button onClick={() => copy(shareMsg, "share")} className="btn-ghost px-3 py-1.5 text-xs">{copied === "share" ? "Copied ✓" : "Copy message"}</button>
              </div>
              <a href="/act" className="mt-3 inline-block text-xs font-semibold text-brick underline underline-offset-2">Get your full action plan →</a>
            </section>
          </div>

          <p className="shrink-0 border-t border-line px-5 py-3 text-[0.65rem] text-slate">{CAMPAIGN.paidForBy}</p>
        </div>
        </>
      )}
    </>
  );
}
