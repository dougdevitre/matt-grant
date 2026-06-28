// Freemium access for the arcade: a visitor may play ONE game free (the first one
// they open); the rest require a free membership (a signed-in Clerk account). The
// "which game was the free one" claim is stored client-side in localStorage — a soft,
// list-building gate (the user accepted it's circumventable), not a hard paywall.
//
// decideAccess is a PURE function so the gate logic is unit-testable without the DOM
// or Clerk. The localStorage helpers are the only browser-touching part.

export const FREE_GAME_KEY = "games:freeGame";

// Note: "signed_in" (not "member") — the repo reserves the literal 'member' for the
// Clerk RBAC role name (lib/rbac.ts; guarded by roles-consistency.test.ts).
export type AccessReason = "signed_in" | "free-available" | "free-claimed" | "gated";
export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason;
}

/**
 * Pure access decision.
 * - signed-in members get every game.
 * - an anonymous visitor with no game claimed yet may play THIS one for free.
 * - the already-claimed free game stays playable.
 * - any other game is gated behind membership.
 */
export function decideAccess(opts: {
  signedIn: boolean;
  gameId: string;
  freeGameId: string | null;
}): AccessDecision {
  if (opts.signedIn) return { allowed: true, reason: "signed_in" };
  if (opts.freeGameId == null) return { allowed: true, reason: "free-available" };
  if (opts.freeGameId === opts.gameId) return { allowed: true, reason: "free-claimed" };
  return { allowed: false, reason: "gated" };
}

/** The game id the visitor has spent their free play on, or null. Client-only. */
export function getFreeGameId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(FREE_GAME_KEY);
  } catch {
    return null;
  }
}

/** Claim this game as the visitor's free play, if they haven't claimed one yet. */
export function claimFreeGame(gameId: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!window.localStorage.getItem(FREE_GAME_KEY)) window.localStorage.setItem(FREE_GAME_KEY, gameId);
  } catch {
    /* storage unavailable (private mode / blocked) — fail open, no claim recorded */
  }
}
