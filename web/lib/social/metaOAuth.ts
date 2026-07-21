import { META_GRAPH, socialAppParam } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";

type MetaPage = { id: string; name?: string; token: string; igUserId?: string; igUsername?: string };

// Meta (Facebook + Instagram) OAuth2 connect logic, extracted from the route
// handlers so it's unit-testable with a mocked fetch. The flow:
//   1. authorizeUrl()  → send the admin to Meta consent.
//   2. exchangeCode()  → code → short-lived user token → long-lived user token →
//      the Page (and its linked IG business account) the campaign posts as.
// Instagram content publishing rides on the Facebook app + a connected IG
// business account, so one Meta connect yields both channels.

// Scopes for posting to a Page and publishing to its IG business account, PLUS the
// 1:1 inbox: pages_messaging (Messenger send/receive) and instagram_manage_messages
// (Instagram DMs). The messaging scopes require Meta App Review — until granted, the
// existing token still posts but can't message (docs/messenger-inbox.md).
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_messaging",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_messages",
].join(",");

export async function authorizeUrl(state: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const appId = await socialAppParam("facebook", "app_id");
  const redirectUri = await socialAppParam("facebook", "redirect_uri");
  if (!appId || !redirectUri) return { ok: false, error: "Facebook app_id / redirect_uri are not set in Parameter Store." };
  const u = new URL(`https://www.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}/dialog/oauth`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", META_SCOPES);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  return { ok: true, url: u.toString() };
}

type MetaToken = { access_token?: string; expires_in?: number };
type MetaPages = {
  data?: Array<{ id?: string; name?: string; access_token?: string; instagram_business_account?: { id?: string; username?: string } }>;
};

async function getJson<T>(url: string): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching Meta" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `Meta ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  try {
    return { ok: true, body: JSON.parse(text) as T };
  } catch {
    return { ok: false, error: "unexpected Meta response" };
  }
}

/**
 * Exchange an OAuth code for a long-lived token and resolve the Page + IG account
 * to post as. Returns a ready-to-store connection (minus bookkeeping fields).
 */
export async function exchangeCode(code: string): Promise<{ ok: true; conn: Omit<SocialConnection, "connectedBy" | "connectedAt"> } | { ok: false; error: string }> {
  const appId = await socialAppParam("facebook", "app_id");
  const appSecret = await socialAppParam("facebook", "app_secret");
  const redirectUri = await socialAppParam("facebook", "redirect_uri");
  if (!appId || !appSecret || !redirectUri) return { ok: false, error: "Facebook app credentials are not set." };

  // 1. code → short-lived user token
  const shortUrl = `${META_GRAPH}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`;
  const short = await getJson<MetaToken>(shortUrl);
  if (!short.ok) return short;
  if (!short.body.access_token) return { ok: false, error: "no short-lived token returned" };

  // 2. short-lived → long-lived user token (~60 days)
  const longUrl = `${META_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${short.body.access_token}`;
  const long = await getJson<MetaToken>(longUrl);
  if (!long.ok) return long;
  const userToken = long.body.access_token ?? short.body.access_token;
  const expiresAt = long.body.expires_in ? new Date(Date.now() + long.body.expires_in * 1000).toISOString() : undefined;

  // 3. resolve the Pages this account manages (each Page's token is what we post
  //    with) + any linked IG account. The first is active; the rest feed the picker.
  const pagesRes = await fetchPages(userToken);
  if (!pagesRes.ok) return pagesRes;
  const pages = pagesRes.pages;
  if (pages.length === 0) return { ok: false, error: "No manageable Facebook Page found for this account." };
  const active = pages[0];

  return {
    ok: true,
    conn: {
      platform: "facebook",
      pageId: active.id,
      pageName: active.name,
      pageToken: active.token,
      igUserId: active.igUserId,
      igUsername: active.igUsername,
      pages,
      userToken,
      expiresAt,
      scopes: META_SCOPES,
    },
  };
}

// GET /me/accounts → flatten into MetaPage[]. Shared by connect + refresh.
async function fetchPages(userToken: string): Promise<{ ok: true; pages: MetaPage[] } | { ok: false; error: string }> {
  const url = `${META_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`;
  const r = await getJson<MetaPages>(url);
  if (!r.ok) return r;
  const pages = (r.body.data ?? [])
    .filter((p) => p.id && p.access_token)
    .map((p) => ({ id: p.id!, name: p.name, token: p.access_token!, igUserId: p.instagram_business_account?.id, igUsername: p.instagram_business_account?.username }));
  return { ok: true, pages };
}

// Refresh a Meta connection: re-exchange the stored long-lived user token for a
// fresh one and re-fetch the active Page's token. Returns updated fields, or null
// on failure (caller keeps the stale connection and surfaces expiry).
export async function refreshConnection(conn: SocialConnection): Promise<SocialConnection | null> {
  const appId = await socialAppParam("facebook", "app_id");
  const appSecret = await socialAppParam("facebook", "app_secret");
  if (!appId || !appSecret || !conn.userToken) return null;
  const longUrl = `${META_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${conn.userToken}`;
  const long = await getJson<MetaToken>(longUrl);
  if (!long.ok || !long.body.access_token) return null;
  const userToken = long.body.access_token;
  const expiresAt = long.body.expires_in ? new Date(Date.now() + long.body.expires_in * 1000).toISOString() : undefined;
  const pagesRes = await fetchPages(userToken);
  if (!pagesRes.ok) return null;
  // Keep the same active Page id if it's still present; else fall back to the first.
  const active = pagesRes.pages.find((p) => p.id === conn.pageId) ?? pagesRes.pages[0];
  if (!active) return null;
  return {
    ...conn,
    userToken,
    expiresAt,
    pages: pagesRes.pages,
    pageId: active.id,
    pageName: active.name,
    pageToken: active.token,
    igUserId: active.igUserId,
    igUsername: active.igUsername,
  };
}
