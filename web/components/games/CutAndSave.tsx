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
    setPhase("over");
    // Optimistic local result; the server re-validates and returns the canonical rank.
    let data: EndData = { score: local.total, ceiling: local.ceiling, rank: null, flags: local.flags };
    try {
      const res = await fetch("/api/games/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: content.gameId,
          seed,
          inputs: session.inputs,
          totalTicks: ROUND_TICKS,
          reportedScore: local.total,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { score: number; ceiling: number; rank: number | null; flags: string[] };
        data = { score: j.score, ceiling: j.ceiling, rank: j.rank, flags: j.flags };
      }
    } catch {
      /* offline / rejected — keep the local result */
    }
    setEnd(data);
  }, [content.gameId, seed, stopLoop]);

  const loop = useCallback(
    (ts: number) => {
      const session = sessionRef.current;
      if (!session) return;
      const elapsed = lastTsRef.current ? ts - lastTsRef.current : DEFAULT_DT_MS;
      lastTsRef.current = ts;
      session.advance(elapsed);
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
          if (item.type === "waste") setFeedback(`✓ Waste cut — relief funded`);
          else if (item.type === "essential") setFeedback(`✗ That funds families — relief lost`);
          else setFeedback(`✗ That pays for itself — yield cut`);
        }
      } else if (input.kind === "borrow") {
        setFeedback("⚠ Borrowed — debt will compound");
      }
      session.enqueue(input);
    },
    [phase],
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
          <Hud
            relief={state.relief}
            taxPct={state.taxPct}
            debt={state.debt}
            streak={state.streak}
            multiplier={state.multiplier}
            secondsLeft={secondsLeft}
          />

          <p className="min-h-[1.5rem] text-sm font-medium text-ink" role="status" aria-live="assertive">
            {feedback}
          </p>

          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            role="group"
            aria-label="Budget line items — cut the waste, leave the rest"
          >
            {state.board.map((item) => {
              const life = Math.max(0, (item.expireTick - state.tick) / ticksToMs);
              const label = labelFor(item, content);
              return (
                <button
                  key={item.id}
                  onClick={() => act({ kind: "cut", id: item.id })}
                  className="group flex flex-col rounded-lg border border-line bg-white p-3 text-left shadow-card transition-transform active:translate-y-px motion-reduce:active:translate-y-0"
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
        </>
      )}

      {phase === "over" && end && (
        <EndScreen
          gameId={content.gameId}
          title={content.title}
          score={end.score}
          ceiling={end.ceiling}
          rank={end.rank}
          flags={end.flags}
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
