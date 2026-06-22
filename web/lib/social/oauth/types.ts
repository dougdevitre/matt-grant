import type { SocialConnection } from "@/lib/social/connections";

// One shape every OAuth provider implements so the connect/callback routes and
// the refresh helper stay platform-agnostic.

// A connection minus the bookkeeping fields the route fills in.
export type ConnInput = Omit<SocialConnection, "connectedBy" | "connectedAt">;

export type AuthorizeResult =
  | { ok: true; url: string; verifier?: string } // verifier = PKCE code_verifier (X)
  | { ok: false; error: string };

export type ExchangeResult = { ok: true; conn: ConnInput } | { ok: false; error: string };

export interface OAuthProvider {
  platform: string;
  /** Build the consent URL. Returns a PKCE verifier to stash in a cookie if used. */
  authorizeUrl(state: string): Promise<AuthorizeResult>;
  /** Exchange the callback code (+ PKCE verifier) for a stored connection. */
  exchangeCode(code: string, verifier?: string): Promise<ExchangeResult>;
  /** Refresh an expiring connection in place; return the updated record or null. */
  refresh?(conn: SocialConnection): Promise<SocialConnection | null>;
}
