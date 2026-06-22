import { META_GRAPH, socialAppParam } from "@/lib/social/credentials";
import type { SocialConnection } from "@/lib/social/connections";

// Meta (Facebook + Instagram) OAuth2 connect logic, extracted from the route
// handlers so it's unit-testable with a mocked fetch. The flow:
//   1. authorizeUrl()  → send the admin to Meta consent.
//   2. exchangeCode()  → code → short-lived user token → long-lived user token →
//      the Page (and its linked IG business account) the campaign posts as.
// Instagram content publishing rides on the Facebook app + a connected IG
// business account, so one Meta connect yields both channels.

// Scopes for posting to a Page and publishing to its IG business account.
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
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

  // 3. resolve the Page (its token is what we post with) + linked IG account
  const pagesUrl = `${META_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`;
  const pages = await getJson<MetaPages>(pagesUrl);
  if (!pages.ok) return pages;
  const page = pages.body.data?.[0];
  if (!page?.id || !page.access_token) return { ok: false, error: "No manageable Facebook Page found for this account." };

  return {
    ok: true,
    conn: {
      platform: "facebook",
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
      igUserId: page.instagram_business_account?.id,
      igUsername: page.instagram_business_account?.username,
      userToken,
      expiresAt,
      scopes: META_SCOPES,
    },
  };
}
