"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { clarityConfig, type RecordCard } from "@/lib/games/clarity-companion";

// A single record rendered as a DOCUMENT card. The faux body is deliberately
// abstract — neutral gray placeholder lines, never words that could name a person
// or a real case (tone guardrail). When the player chooses "Redact & Open", a few
// of those lines are briefly masked with black redaction bars (the "child PII")
// while the rest stay visible (the "public substance"), teaching what redaction
// does — then the real action handler fires. Reduced-motion shows the bars
// statically with no slide.

type ActionKind = "open" | "protect" | "redact";

const FLOOR = clarityConfig.meterFloor;
const LIFE = clarityConfig.cardLifeTicks;

// Brief, calm redaction beat before the card resolves (ms). Long enough to read,
// short enough to keep triage flowing.
const REDACT_MS = 520;

// Deterministic faux body so the same card always renders the same lines (no
// wall-clock / Math.random in render). Derived purely from the card id.
function fauxLines(id: string): { width: number; redact: boolean }[] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const widths = [92, 78, 96, 64, 88];
  // Mark two interior lines as the "child PII" that redaction would mask.
  return widths.map((w, i) => {
    const jitter = ((h >>> (i * 3)) & 0x0f) - 8; // -8..7
    const width = Math.max(40, Math.min(98, w + jitter));
    const redact = i === 1 || i === 3;
    return { width, redact };
  });
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export interface ClarityRecordCardProps {
  card: RecordCard;
  label: string;
  /** Live current tick from game state, for the per-card expiry bar. */
  currentTick: number;
  /** Wired straight to the existing action handler in the parent. */
  onAct: (card: RecordCard, kind: ActionKind) => void;
}

export function ClarityRecordCard({ card, label, currentTick, onAct }: ClarityRecordCardProps) {
  const reduced = usePrefersReducedMotion();
  const [redacting, setRedacting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const lines = fauxLines(card.id);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const remaining = Math.max(0, Math.min(1, (card.expireTick - currentTick) / LIFE));
  const expiringSoon = remaining <= 0.25;

  const fire = (kind: ActionKind) => {
    if (redacting) return;
    if (kind !== "redact") {
      onAct(card, kind);
      return;
    }
    // Teach redaction first, then resolve. Reduced-motion still pauses briefly so
    // the static bars register, but skips the slide animation.
    setRedacting(true);
    timerRef.current = window.setTimeout(
      () => {
        onAct(card, "redact");
      },
      reduced ? 220 : REDACT_MS,
    );
  };

  return (
    <li className="rounded-lg border border-line bg-white p-3 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <span className="eyebrow text-slate">Record</span>
      </div>

      {/* Faux document body — abstract gray lines only. */}
      <div className="clarity-doc mt-2 space-y-1.5" aria-hidden="true">
        {lines.map((ln, i) => {
          const masked = redacting && ln.redact;
          return (
            <div key={i} className="relative h-2 overflow-hidden rounded-sm">
              <span className="block h-full rounded-sm bg-line" style={{ width: `${ln.width}%` }} />
              {masked && (
                <span
                  className={`clarity-redact absolute inset-y-0 left-0 rounded-sm bg-ink ${reduced ? "" : "clarity-redact-anim"}`}
                  style={{ width: `${ln.width}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {redacting && (
        <p className="mt-2 text-xs font-medium text-ink" role="status" aria-live="polite">
          Redacting child details — opening public substance…
        </p>
      )}

      {/* Per-card expiry timer — thin, calm. Color-independent: paired with text. */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="eyebrow text-slate">
            Time to act{expiringSoon ? " — expiring" : ""}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-slate">
            {Math.round(remaining * 100)}%
          </span>
        </div>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
          <span
            className={`clarity-life block h-full rounded-full ${expiringSoon ? "bg-brick" : "bg-slate"}`}
            style={{ width: `${remaining * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => fire("open")}
          disabled={redacting}
          className="btn-ghost text-xs disabled:opacity-50"
          aria-label={`Open ${label}`}
        >
          Open
        </button>
        <button
          onClick={() => fire("protect")}
          disabled={redacting}
          className="btn-ghost text-xs disabled:opacity-50"
          aria-label={`Protect ${label}`}
        >
          Protect
        </button>
        <button
          onClick={() => fire("redact")}
          disabled={redacting}
          className="btn-ghost text-xs disabled:opacity-50"
          aria-label={`Redact and open ${label}`}
        >
          Redact &amp; Open
        </button>
      </div>

      <style jsx>{`
        .clarity-life {
          transition: width 180ms linear;
        }
        .clarity-redact-anim {
          animation: clarity-slide 360ms cubic-bezier(0.22, 0.61, 0.36, 1) both;
          transform-origin: left center;
        }
        @keyframes clarity-slide {
          from {
            clip-path: inset(0 100% 0 0);
          }
          to {
            clip-path: inset(0 0 0 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .clarity-life {
            transition: none;
          }
          .clarity-redact-anim {
            animation: none;
          }
        }
      `}</style>
    </li>
  );
}

export { FLOOR as CLARITY_METER_FLOOR };
