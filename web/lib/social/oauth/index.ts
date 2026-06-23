import type { OAuthProvider } from "@/lib/social/oauth/types";
import { facebookProvider } from "@/lib/social/oauth/facebook";
import { xProvider } from "@/lib/social/oauth/x";
import { linkedinProvider } from "@/lib/social/oauth/linkedin";
import { youtubeProvider } from "@/lib/social/oauth/youtube";

// Connectable OAuth providers, keyed by platform. The connect/callback routes and
// the refresh helper look providers up here so they stay platform-agnostic.
const PROVIDERS: Record<string, OAuthProvider> = {
  facebook: facebookProvider,
  x: xProvider,
  linkedin: linkedinProvider,
  youtube: youtubeProvider,
};

export function getProvider(platform: string): OAuthProvider | null {
  return PROVIDERS[platform] ?? null;
}

export const CONNECTABLE_PLATFORMS = Object.keys(PROVIDERS);
