import "server-only";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE, PK, dbConfigured, newId } from "@/lib/db";
import { getSecret } from "@/lib/ssm";
import { GAMES, type GameMeta } from "@/lib/games/registry";

// Anonymous arcade leaderboard, single-table. NO PII ever lands here — only a game
// id, a clamped score, and 2–3 player-chosen initials. Scores are zero-padded in the
// sort key so a descending Query returns the true top-N regardless of magnitude.

const SCORE_PAD = 12; // max score well under 10^12; pad so lexical sort == numeric sort
const pad = (n: number) => Math.max(0, Math.floor(n)).toString().padStart(SCORE_PAD, "0");

const sanitizeInitials = (raw: string | undefined): string =>
  (raw ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "AAA";

export interface LeaderboardEntry {
  gameId: string;
  score: number;
  initials: string;
  ts: string;
}

/** Persist an anonymous score. Returns the stored entry, or null if the DB is unconfigured. */
export async function saveScore(gameId: string, score: number, initials?: string): Promise<LeaderboardEntry | null> {
  if (!dbConfigured) return null;
  const entry: LeaderboardEntry = {
    gameId,
    score: Math.max(0, Math.floor(score)),
    initials: sanitizeInitials(initials),
    ts: new Date().toISOString(),
  };
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: PK.gameScores,
        SK: `${gameId}#${pad(entry.score)}#${newId()}`,
        ...entry,
      },
    }),
  );
  return entry;
}

/** Top-N anonymous scores for a game, highest first. */
export async function topScores(gameId: string, n = 10): Promise<LeaderboardEntry[]> {
  if (!dbConfigured) return [];
  try {
    const out = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: { ":pk": PK.gameScores, ":prefix": `${gameId}#` },
        ScanIndexForward: false, // descending SK → highest padded score first
        Limit: Math.min(Math.max(n, 1), 100),
      }),
    );
    return (out.Items ?? []).map((i) => ({
      gameId: String(i.gameId),
      score: Number(i.score ?? 0),
      initials: sanitizeInitials(String(i.initials ?? "")),
      ts: String(i.ts ?? ""),
    }));
  } catch {
    return [];
  }
}

/** Approximate rank (1-based) of `score` among stored scores for a game. */
export async function rankFor(gameId: string, score: number): Promise<number | null> {
  if (!dbConfigured) return null;
  try {
    const out = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "PK = :pk AND SK > :floor",
        ExpressionAttributeValues: { ":pk": PK.gameScores, ":floor": `${gameId}#${pad(score)}#~` },
        Select: "COUNT",
      }),
    );
    return (out.Count ?? 0) + 1;
  } catch {
    return null;
  }
}

// Live per-game enabled state. Build-time defaults come from the registry; a runtime
// override in SSM (/matt-grant/GAMES_FLAGS, a JSON map of {gameId: boolean}) lets
// compliance flip a game off WITHOUT a deploy (spec §12 kill switch). Missing/invalid
// param → registry defaults.
export async function gameFlags(): Promise<Record<string, boolean>> {
  const defaults: Record<string, boolean> = Object.fromEntries(GAMES.map((g: GameMeta) => [g.id, g.enabled]));
  const rawOverride = await getSecret("GAMES_FLAGS");
  if (!rawOverride) return defaults;
  try {
    const override = JSON.parse(rawOverride) as Record<string, unknown>;
    for (const [id, val] of Object.entries(override)) {
      if (id in defaults && typeof val === "boolean") defaults[id] = val;
    }
  } catch {
    /* malformed param → defaults */
  }
  return defaults;
}
