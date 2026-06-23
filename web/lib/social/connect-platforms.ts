// Platforms the connections panel offers an in-app OAuth "Connect" button for.
// MUST stay in sync with the OAuth provider registry (CONNECTABLE_PLATFORMS in
// lib/social/oauth/index.ts) — oauth.test.ts asserts the two match, so registering a
// provider without surfacing its Connect button (or vice-versa) fails CI. Threads is
// intentionally absent: it has no OAuth provider and works via manual token only.
export const CONNECT_PLATFORMS = ["facebook", "x", "linkedin", "tiktok", "youtube"] as const;

export type ConnectPlatform = (typeof CONNECT_PLATFORMS)[number];
