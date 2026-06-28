import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { validateScore } from "@/lib/games/server/validate";
import { saveScore, rankFor, gameFlags } from "@/lib/games/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Submit a finished run. The server re-runs the SAME deterministic replay() the
// client ran and rejects (422) any score it can't reproduce from (seed, inputs) —
// the anti-cheat guarantee. Per-IP rate-limited. No PII: only optional initials are
// stored alongside the clamped score.

const SubmissionSchema = z
  .object({
    gameId: z.string().min(1).max(40),
    seed: z.string().min(1).max(120),
    inputs: z
      .array(z.object({ tick: z.number().int().nonnegative(), input: z.unknown() }))
      .max(5000), // generous upper bound; a 45s round at 30Hz can't exceed this
    totalTicks: z.number().int().nonnegative().max(10000),
    reportedScore: z.number().int().nonnegative(),
    initials: z.string().max(10).optional(),
  })
  .strict();

export async function POST(req: Request) {
  const rl = await rateLimit(`games-score:${clientIp(req)}`, { limit: 30, windowSec: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many submissions — please slow down." }, { status: 429 });
  }

  let body: z.infer<typeof SubmissionSchema>;
  try {
    body = SubmissionSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  // Don't accept scores for a game compliance has disabled.
  const flags = await gameFlags();
  if (flags[body.gameId] === false) {
    return NextResponse.json({ error: "This game is not currently available." }, { status: 403 });
  }

  // zod infers `input?: unknown` for z.unknown(); normalize to the engine's required
  // InputEvent shape before replay validation.
  const inputs = body.inputs.map((e) => ({ tick: e.tick, input: e.input }));
  const result = validateScore(body.gameId, body.seed, inputs, body.reportedScore);
  if (!result.ok) {
    const status = result.reason === "unknown_game" ? 404 : 422;
    return NextResponse.json(
      { ok: false, reason: result.reason, recomputed: result.recomputed },
      { status },
    );
  }

  const saved = await saveScore(body.gameId, result.recomputed, body.initials);
  const rank = await rankFor(body.gameId, result.recomputed);
  return NextResponse.json({
    ok: true,
    score: result.recomputed,
    ceiling: result.ceiling,
    flags: result.flags,
    rank,
    recorded: Boolean(saved),
  });
}
