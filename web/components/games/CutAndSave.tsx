"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createLiveSession, xfnv1a, DEFAULT_DT_MS, type LiveSession } from "@/lib/games/engine";
import {
  buildCutAndSave,
  cutSaveConfig,
  type BoardItem,
  type CutSaveInput,
  type CutSaveState,
} from "@/lib/games/cut-and-save";
import type { GameContent } from "@/lib/games/content-schema";
import { Hud } from "./Hud";
import { EndScreen } from "./EndScreen";
import { CutAndSaveTaxGauge } from "./CutAndSaveTaxGauge";
import { CutAndSaveDebtMeter } from "./CutAndSaveDebtMeter";

// Cut & Save — the client view. It DRIVES the shared engine (createLiveSession) with a
// requestAnimationFrame loop, records every input, and on round-end submits
// (seed, inputs) to /api/games/score, which re-runs the SAME replay() to validate.
// The sim itself stays pure + deterministic; this component only handles real-time,
// input capture, and presentation.

type Phase = "ready" | "playing" | "over";

interface EndData {
  score: number;
  ceiling: number;
  rank: number | null;
  flags: string[];
}

const ticksToMs = cutSaveConfig.itemLifeTicks; // for the life bar
const ROUND_TICKS = cutSaveConfig.roundTicks;
const newSeed = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

// Cosmetic category label for an item — derived deterministically from its id so the
// same item always reads the same, without consuming the sim rng. The TYPE is hidden
// from the player; reading the label + judging it is the skill.
function labelFor(item: BoardItem, content: GameContent): string {
  const pool = content.itemLabels[item.type] ?? [item.type];
  return pool[xfnv1a(item.id) % pool.length];
}

export function CutAndSave({ content }: { content: GameContent }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [seed, setSeed] = useState<string>(newSeed);
  const [end, setEnd] = useState<EndData | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [, repaint] = useReducer((n: number) => n + 1, 0);

  // ── Presentation-only juice (no sim coupling) ────────────────────────────────
  // Floating "+$X" deltas anchored to a tile id, auto-expiring.
  const [floaters, setFloaters] = useState<{ key: number; id: string; text: string; tone: "good" | "bad" }[]>([]);
  const floaterSeq = useRef(0);
  // Tiles currently animating out after a cut (id → still rendered as a ghost briefly).
  const [cutting, setCutting] = useState<Set<string>>(new Set());
  // Brief board shake when a family is harmed.
  const [harmShake, setHarmShake] = useState(false);
  const harmRef = useRef(0);

  const addFloater = useCallback((id: string, text: string, tone: "good" | "bad") => {
    const key = floaterSeq.current++;
    setFloaters((f) => [...f, { key, id, text, tone }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.key !== key)), 900);
  }, []);

  const markCutting = useCallback((id: string) => {
    setCutting((s) => {
      const n = new Set(s);
      n.add(id);
      return n;
    });
    setTimeout(() => {
      setCutting((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 260);
  }, []);

  const sessionRef = useRef<LiveSession<CutSaveState, CutSaveInput> | null>(null);
  const gameRef = useRef(buildCutAndSave());
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const finalize = useCallback(async () => {
    stopLoop();
    const session = sessionRef.current;
    if (!session) return;
    const local = gameRef.current.score(session.state);
    // Show the local (validated-on-submit) result immediately; EndScreen submits the
    // replay to /api/games/score for the leaderboard once the player adds initials.
    setEnd({ score: local.total, ceiling: local.ceiling, rank: null, flags: local.flags });
    setPhase("over");
  }, [stopLoop]);

  const loop = useCallback(
    (ts: number) => {
      const session = sessionRef.current;
      if (!session) return;
      const elapsed = lastTsRef.current ? ts - lastTsRef.current : DEFAULT_DT_MS;
      lastTsRef.current = ts;
      session.advance(elapsed);
      // Cosmetic harm cue — detect an authoritative familiesHarmed increase from the sim.
      const harmNow = session.state.familiesHarmed;
      if (harmNow > harmRef.current) {
        harmRef.current = harmNow;
        setHarmShake(true);
        setTimeout(() => setHarmShake(false), 360);
      }
      repaint();
      if (session.isOver()) {
        void finalize();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [finalize],
  );

  const start = useCallback(() => {
    gameRef.current = buildCutAndSave();
    sessionRef.current = createLiveSession(gameRef.current, cutSaveConfig, seed);
    lastTsRef.current = 0;
    harmRef.current = 0;
    setFloaters([]);
    setCutting(new Set());
    setHarmShake(false);
    setFeedback("");
    setEnd(null);
    setPhase("playing");
    rafRef.current = requestAnimationFrame(loop);
  }, [seed, loop]);

  const playAgain = useCallback(() => {
    setSeed(newSeed());
    setPhase("ready");
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const act = useCallback(
    (input: CutSaveInput) => {
      const session = sessionRef.current;
      if (!session || phase !== "playing") return;
      // Feedback is computed against the CURRENT (pre-apply) state for an instant cue;
      // the authoritative effect lands on the next drained tick inside the sim.
      if (input.kind === "cut") {
        const item = session.state.board.find((b) => b.id === input.id);
        if (item) {
          markCutting(item.id);
          if (item.type === "waste") {
            setFeedback(`✓ Waste cut — relief funded`);
            addFloater(item.id, `+$${item.value.toLocaleString("en-US")}`, "good");
          } else if (item.type === "essential") {
            setFeedback(`✗ That funds families — relief lost`);
            addFloater(item.id, "harm", "bad");
          } else {
            setFeedback(`✗ That pays for itself — yield cut`);
            addFloater(item.id, "no gain", "bad");
          }
        }
      } else if (input.kind === "borrow") {
        setFeedback("⚠ Borrowed — debt will compound");
      }
      session.enqueue(input);
    },
    [phase, addFloater, markCutting],
  );

  const session = sessionRef.current;
  const state = session?.state;
  const secondsLeft = state ? (ROUND_TICKS - state.tick) * (DEFAULT_DT_MS / 1000) : ROUND_TICKS * (DEFAULT_DT_MS / 1000);

  return (
    <div className="space-y-6">
      {phase === "ready" && (
        <div className="rounded-lg border border-line bg-white p-6 shadow-card">
          <p className="eyebrow text-slate">{content.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{content.title}</h1>
          <p className="mt-2 max-w-prose text-slate">{content.tagline}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink">
            {content.howTo.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <button onClick={start} className="btn-brick mt-6">
            Start
          </button>
        </div>
      )}

      {phase === "playing" && state && (
        <>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <Hud
              relief={state.relief}
              taxPct={state.taxPct}
              debt={state.debt}
              streak={state.streak}
              multiplier={state.multiplier}
              secondsLeft={secondsLeft}
            />
            <CutAndSaveTaxGauge taxPct={state.taxPct} />
          </div>

          <CutAndSaveDebtMeter debt={state.debt} />

          <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="assertive">
            {feedback}
          </p>

          <div
            className={`cs-board grid grid-cols-2 gap-3 sm:grid-cols-3 ${harmShake ? "is-harm" : ""}`}
            role="group"
            aria-label="Budget line items — cut the waste, leave the rest"
          >
            {state.board.map((item) => {
              const life = Math.max(0, (item.expireTick - state.tick) / ticksToMs);
              const label = labelFor(item, content);
              const isCutting = cutting.has(item.id);
              const itemFloaters = floaters.filter((f) => f.id === item.id);
              return (
                <div key={item.id} className="relative">
                  <button
                    onClick={() => act({ kind: "cut", id: item.id })}
                    disabled={isCutting}
                    className={`cs-tile group flex w-full flex-col rounded-lg border border-line bg-white p-3 text-left shadow-card transition-transform active:translate-y-px motion-reduce:active:translate-y-0 ${
                      isCutting ? "cs-tile-out" : ""
                    }`}
                    aria-label={`Cut: ${label}`}
                  >
                    <span className="text-sm font-semibold text-ink">{label}</span>
                    <span className="mt-1 font-mono text-xs text-slate">${item.value.toLocaleString("en-US")}</span>
                    <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
                      <span className="block h-full bg-ink" style={{ width: `${Math.min(100, life * 100)}%` }} />
                    </span>
                    <span className="mt-1 text-[0.7rem] uppercase tracking-wide text-brick opacity-0 group-hover:opacity-100 group-focus:opacity-100">
                      Cut ✂
                    </span>
                  </button>
                  {itemFloaters.map((f) => (
                    <span
                      key={f.key}
                      aria-hidden="true"
                      className={`cs-floater pointer-events-none absolute right-2 top-1 font-mono text-xs font-bold ${
                        f.tone === "good" ? "text-ink" : "text-brick"
                      }`}
                    >
                      {f.tone === "good" ? f.text : `✗ ${f.text}`}
                    </span>
                  ))}
                </div>
              );
            })}
            {state.board.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-slate">Watching the budget… items incoming.</p>
            )}
          </div>

          <div>
            <button
              onClick={() => act({ kind: "borrow" })}
              className="btn-ghost text-xs"
              aria-label="Borrow for instant tax relief (warning: compounds into debt)"
            >
              Borrow for instant relief ⚠
            </button>
          </div>

          <style jsx>{`
            .cs-tile {
              animation: cs-tile-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            .cs-tile-out {
              animation: cs-tile-out 240ms ease-in forwards;
            }
            @keyframes cs-tile-in {
              from {
                opacity: 0;
                transform: scale(0.92);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
            @keyframes cs-tile-out {
              to {
                opacity: 0;
                transform: scale(0.9);
              }
            }
            .cs-floater {
              animation: cs-float 900ms ease-out forwards;
            }
            @keyframes cs-float {
              0% {
                opacity: 0;
                transform: translateY(4px);
              }
              20% {
                opacity: 1;
              }
              100% {
                opacity: 0;
                transform: translateY(-22px);
              }
            }
            .cs-board.is-harm {
              animation: cs-shake 360ms ease-in-out;
            }
            @keyframes cs-shake {
              0%,
              100% {
                transform: translateX(0);
              }
              20% {
                transform: translateX(-5px);
              }
              40% {
                transform: translateX(5px);
              }
              60% {
                transform: translateX(-3px);
              }
              80% {
                transform: translateX(3px);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .cs-tile,
              .cs-tile-out,
              .cs-floater,
              .cs-board.is-harm {
                animation: none;
              }
              .cs-tile-out {
                opacity: 0;
              }
              .cs-floater {
                opacity: 1;
              }
            }
          `}</style>
        </>
      )}

      {phase === "over" && end && (
        <EndScreen
          gameId={content.gameId}
          title={content.title}
          score={end.score}
          ceiling={end.ceiling}
          flags={end.flags}
          seed={seed}
          inputs={sessionRef.current?.inputs ?? []}
          totalTicks={ROUND_TICKS}
          endLines={content.endLines}
          shareText={content.shareText}
          issueSlug={content.issueSlug}
          issueLabel={content.eyebrow}
          onPlayAgain={playAgain}
        />
      )}
    </div>
  );
}
