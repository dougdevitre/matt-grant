// Channel publishing adapters. Each channel either auto-publishes through its API
// (when the campaign has wired that platform's credentials) or degrades to
// "manual" mode — the post is staged with copy-ready text + media in S3 and waits
// for a human to push it, exactly how Buffer/Hootsuite handle platforms without a
// publish API. This mirrors the rest of the app: SES, Clerk, and S3 all degrade
// gracefully when their config is absent, and so does this.
//
// To enable auto-publish for a channel, provide its access token via env/SSM
// (read through getSecret). No tokens are committed; absence = manual mode.

import { getSecret } from "@/lib/ssm";
import { SITE_URL } from "@/lib/site";
import { composeText, type ChannelId } from "@/lib/social/channels";
import { getFreshConnection } from "@/lib/social/oauth/refresh";
import { META_GRAPH } from "@/lib/social/credentials";

// Threads (Meta) has its own Graph host, versioned independently of the Facebook
// Graph. Both publishing steps and the connection check go through it.
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

export type PublishablePost = {
  caption: string;
  hashtags: string[];
  link?: string;
  mediaUrl?: string; // public CloudFront URL of the attached image
};

export type PublishResult =
  | { ok: true; mode: "api"; externalId?: string }
  | { ok: true; mode: "manual" } // staged; awaiting a human to post it
  | { ok: false; mode: "api" | "manual"; error: string };

// Flat-name secrets for the manual token drop-in path (the fallback when the
// in-app OAuth connect flow hasn't stored a connection).
type ChannelConfig = { token: string; id?: string };
const CHANNEL_CONFIG: Record<ChannelId, ChannelConfig> = {
  x: { token: "X_ACCESS_TOKEN" },
  facebook: { token: "FACEBOOK_PAGE_TOKEN", id: "FACEBOOK_PAGE_ID" },
  instagram: { token: "INSTAGRAM_ACCESS_TOKEN", id: "INSTAGRAM_USER_ID" },
  linkedin: { token: "LINKEDIN_ACCESS_TOKEN", id: "LINKEDIN_AUTHOR_URN" },
  tiktok: { token: "TIKTOK_ACCESS_TOKEN" },
  youtube: { token: "YOUTUBE_ACCESS_TOKEN" },
  threads: { token: "THREADS_ACCESS_TOKEN", id: "THREADS_USER_ID" },
};

// The resolved credentials a publisher needs: an access token, plus the account
// id (FB Page / IG user) or author URN (LinkedIn) where applicable.
export type ResolvedCreds = { token: string; accountId?: string; authorUrn?: string };

// Resolve a channel's posting credentials: the in-app OAuth connection (DynamoDB)
// first, then the flat-name env/SSM fallback. Returns null when nothing is wired,
// which the callers treat as "manual mode" (stage for a human).
export async function resolveCredentials(channel: ChannelId): Promise<ResolvedCreds | null> {
  // 1. Stored OAuth connection from the connect flow. Meta's "facebook" record
  //    powers both Facebook (Page) and Instagram (Page token + linked IG account).
  if (channel === "facebook" || channel === "instagram") {
    const conn = await getFreshConnection("facebook");
    if (conn?.pageToken) {
      if (channel === "facebook" && conn.pageId) return { token: conn.pageToken, accountId: conn.pageId };
      if (channel === "instagram" && conn.igUserId) return { token: conn.pageToken, accountId: conn.igUserId };
    }
  } else {
    const conn = await getFreshConnection(channel);
    if (conn?.accessToken) {
      if (channel === "linkedin") return conn.authorUrn ? { token: conn.accessToken, authorUrn: conn.authorUrn } : null;
      return { token: conn.accessToken };
    }
  }
  // 2. Flat-name env/SSM fallback (manual token drop-in).
  const cfg = CHANNEL_CONFIG[channel];
  const token = await getSecret(cfg.token).catch(() => null);
  if (!token) return null;
  if (channel === "facebook") {
    const id = await getSecret("FACEBOOK_PAGE_ID");
    return id ? { token, accountId: id } : null;
  }
  if (channel === "instagram") {
    const id = await getSecret("INSTAGRAM_USER_ID");
    return id ? { token, accountId: id } : null;
  }
  if (channel === "linkedin") {
    const urn = await getSecret("LINKEDIN_AUTHOR_URN");
    return urn ? { token, authorUrn: urn } : null;
  }
  if (channel === "threads") {
    const id = await getSecret("THREADS_USER_ID");
    return id ? { token, accountId: id } : null;
  }
  return { token };
}

/** True if this channel has credentials wired (OAuth connection or manual token). */
export async function channelConfigured(channel: ChannelId): Promise<boolean> {
  try {
    return !!(await resolveCredentials(channel));
  } catch {
    return false;
  }
}

// Resolve a media URL Meta can fetch: relative app URLs (e.g. /api/graphics?…,
// which is public) become absolute against the live site; absolute URLs pass
// through; anything else is dropped.
export function absoluteMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SITE_URL}${url}`;
  return undefined;
}

// Per-channel API senders. Only reached when the channel is fully configured, so
// the default deployment never calls them. Channels without an adapter fail loudly
// rather than silently dropping a post the admin believes went out via API.
async function apiPublish(channel: ChannelId, post: PublishablePost, creds: ResolvedCreds): Promise<PublishResult> {
  if (channel === "x") return publishToX(post, creds.token);
  if (channel === "facebook") return publishToFacebook(post, creds);
  if (channel === "instagram") return publishToInstagram(post, creds);
  if (channel === "linkedin") return publishToLinkedIn(post, creds);
  if (channel === "threads") return publishToThreads(post, creds);
  return { ok: false, mode: "api", error: `Auto-publish for ${channel} is not implemented yet — connect it or remove its ${CHANNEL_CONFIG[channel].token}.` };
}

// Shared POST + error handling for Meta Graph endpoints. Returns the created id
// (`id` for IG / Page feed, `post_id` for Page photos) or a client-safe error.
async function metaPost(url: string, params: Record<string, string>): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching Meta" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `Meta API ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  let body: { id?: string; post_id?: string } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON 2xx — treat as success without an id */
  }
  return { ok: true, id: body?.id ?? body?.post_id };
}

// LinkedIn. Posts a UGC share as the configured author (org or person URN) via
// /v2/ugcPosts. Text shares carry the link in the commentary text; an attached
// graphic is sent through the register-upload flow and referenced as an IMAGE asset.
// Needs LINKEDIN_AUTHOR_URN (e.g. urn:li:organization:123) + a token with
// w_organization_social/w_member_social.
async function publishToLinkedIn(post: PublishablePost, creds: ResolvedCreds): Promise<PublishResult> {
  const author = creds.authorUrn;
  const token = creds.token;
  if (!author) return { ok: false, mode: "api", error: "LinkedIn author URN is not set." };

  // With a graphic attached, register + upload the image and reference its asset.
  let shareMedia: { shareMediaCategory: string; media?: unknown[] } = { shareMediaCategory: "NONE" };
  const media = absoluteMediaUrl(post.mediaUrl);
  if (media) {
    const up = await uploadLinkedInImage(media, author, token);
    if (!up.ok) return { ok: false, mode: "api", error: up.error };
    shareMedia = { shareMediaCategory: "IMAGE", media: [{ status: "READY", media: up.asset }] };
  }

  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: copyText(post) }, ...shareMedia } },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  let res: Response;
  try {
    res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-restli-protocol-version": "2.0.0" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, mode: "api", error: err instanceof Error ? err.message : "network error reaching LinkedIn" };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, mode: "api", error: `LinkedIn API ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}` };
  }
  // The created share id comes back in the x-restli-id header (or the body).
  const headerId = res.headers.get("x-restli-id");
  if (headerId) return { ok: true, mode: "api", externalId: headerId };
  const body = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, mode: "api", externalId: body?.id };
}

// LinkedIn image upload: register an upload slot, PUT the graphic bytes, and
// return the asset URN to reference in the share. Three steps, each surfacing a
// clear error rather than silently dropping the image.
async function uploadLinkedInImage(mediaUrl: string, author: string, token: string): Promise<{ ok: true; asset: string } | { ok: false; error: string }> {
  // 1. register the upload
  let reg: Response;
  try {
    reg = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-restli-protocol-version": "2.0.0" },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: author,
          serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
        },
      }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching LinkedIn" };
  }
  if (!reg.ok) return { ok: false, error: `LinkedIn registerUpload ${reg.status}` };
  const regBody = (await reg.json().catch(() => null)) as
    | { value?: { asset?: string; uploadMechanism?: { ["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?: { uploadUrl?: string } } } }
    | null;
  const asset = regBody?.value?.asset;
  const uploadUrl = regBody?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  if (!asset || !uploadUrl) return { ok: false, error: "LinkedIn did not return an upload URL." };

  // 2. fetch the image bytes (the public on-brand graphic)
  let img: Response;
  try {
    img = await fetch(mediaUrl);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "could not fetch the image" };
  }
  if (!img.ok) return { ok: false, error: `could not fetch image (${img.status})` };
  const bytes = await img.arrayBuffer();

  // 3. PUT the bytes to the upload URL
  try {
    const put = await fetch(uploadUrl, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: bytes });
    if (!put.ok) return { ok: false, error: `LinkedIn media upload ${put.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error uploading to LinkedIn" };
  }
  return { ok: true, asset };
}

// Facebook Page. With an image → POST {page}/photos (url + caption); text-only →
// POST {page}/feed (message + optional link). Needs FACEBOOK_PAGE_ID + a Page
// access token with pages_manage_posts.
async function publishToFacebook(post: PublishablePost, creds: ResolvedCreds): Promise<PublishResult> {
  const pageId = creds.accountId;
  const token = creds.token;
  if (!pageId) return { ok: false, mode: "api", error: "Facebook Page id is not set." };
  const message = copyText(post);
  const media = absoluteMediaUrl(post.mediaUrl);
  const r = media
    ? await metaPost(`${META_GRAPH}/${pageId}/photos`, { url: media, caption: message, access_token: token })
    : await metaPost(`${META_GRAPH}/${pageId}/feed`, { message, ...(post.link ? { link: post.link } : {}), access_token: token });
  return r.ok ? { ok: true, mode: "api", externalId: r.id } : { ok: false, mode: "api", error: r.error };
}

// Instagram (Graph API content publishing). Two steps: create a media container
// from a PUBLIC image_url + caption, then publish it. IG has no text-only post, so
// an image is required. Needs INSTAGRAM_USER_ID (IG business/creator account) + a
// token with instagram_content_publish.
async function publishToInstagram(post: PublishablePost, creds: ResolvedCreds): Promise<PublishResult> {
  const igUserId = creds.accountId;
  const token = creds.token;
  if (!igUserId) return { ok: false, mode: "api", error: "Instagram account id is not set." };
  const media = absoluteMediaUrl(post.mediaUrl);
  if (!media) return { ok: false, mode: "api", error: "Instagram requires an image — attach a graphic before scheduling." };

  const created = await metaPost(`${META_GRAPH}/${igUserId}/media`, { image_url: media, caption: copyText(post), access_token: token });
  if (!created.ok) return { ok: false, mode: "api", error: created.error };
  if (!created.id) return { ok: false, mode: "api", error: "Instagram did not return a media container id." };

  // Images are processed near-instantly, so publish straight away. (Video/Reels
  // would need a status poll on the container before publishing.)
  const published = await metaPost(`${META_GRAPH}/${igUserId}/media_publish`, { creation_id: created.id, access_token: token });
  return published.ok ? { ok: true, mode: "api", externalId: published.id } : { ok: false, mode: "api", error: published.error };
}

// Threads (Meta's text-first network). Same two-step container → publish flow as
// Instagram, but on graph.threads.net — and text-only is allowed (no image
// required), so a plain caption posts as a TEXT thread and an attached graphic as
// an IMAGE thread. Needs THREADS_USER_ID + a token with
// threads_basic/threads_content_publish.
async function publishToThreads(post: PublishablePost, creds: ResolvedCreds): Promise<PublishResult> {
  const userId = creds.accountId;
  const token = creds.token;
  if (!userId) return { ok: false, mode: "api", error: "Threads user id is not set." };
  const media = absoluteMediaUrl(post.mediaUrl);

  const created = await metaPost(`${THREADS_GRAPH}/${userId}/threads`, {
    media_type: media ? "IMAGE" : "TEXT",
    text: copyText(post),
    ...(media ? { image_url: media } : {}),
    access_token: token,
  });
  if (!created.ok) return { ok: false, mode: "api", error: created.error };
  if (!created.id) return { ok: false, mode: "api", error: "Threads did not return a media container id." };

  const published = await metaPost(`${THREADS_GRAPH}/${userId}/threads_publish`, { creation_id: created.id, access_token: token });
  return published.ok ? { ok: true, mode: "api", externalId: published.id } : { ok: false, mode: "api", error: published.error };
}

// Upload an image to X and return its media id, for attaching to a tweet. Targets
// the X API v2 media upload endpoint with the same OAuth2 user-context Bearer.
// Defensive id parsing (data.id / media_id_string / id) since the field has
// shifted across X API versions — verify against live creds before relying on it.
async function uploadXMedia(mediaUrl: string, token: string): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  let imgRes: Response;
  try {
    imgRes = await fetch(mediaUrl);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "could not fetch the image" };
  }
  if (!imgRes.ok) return { ok: false, error: `could not fetch image (${imgRes.status})` };
  const bytes = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/png";

  const form = new FormData();
  form.append("media", new Blob([bytes], { type: contentType }), "image");
  form.append("media_category", "tweet_image");
  let res: Response;
  try {
    res = await fetch("https://api.x.com/2/media/upload", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching X media upload" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `X media ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
  let body: { data?: { id?: string }; media_id_string?: string; id?: string } | null = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* fall through to the no-id error */
  }
  const id = body?.data?.id ?? body?.media_id_string ?? body?.id;
  return id ? { ok: true, mediaId: String(id) } : { ok: false, error: "X media upload returned no media id" };
}

// Reference adapter: post to X via API v2 (POST /2/tweets with an OAuth2
// user-context Bearer token that has tweet.write scope). When the post has an
// image, it's uploaded first and attached via media_ids; a media failure surfaces
// as a post failure (never a silent text-only fallback). A non-2xx tweet response
// likewise surfaces as a failure, not a silent OK.
async function publishToX(post: PublishablePost, token: string): Promise<PublishResult> {
  const text = copyText(post);
  let mediaIds: string[] | undefined;
  const media = absoluteMediaUrl(post.mediaUrl);
  if (media) {
    const up = await uploadXMedia(media, token);
    if (!up.ok) return { ok: false, mode: "api", error: up.error };
    mediaIds = [up.mediaId];
  }

  let res: Response;
  try {
    res = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text, ...(mediaIds ? { media: { media_ids: mediaIds } } : {}) }),
    });
  } catch (err) {
    return { ok: false, mode: "api", error: err instanceof Error ? err.message : "network error reaching X" };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, mode: "api", error: `X API ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` };
  }
  const body = (await res.json().catch(() => null)) as { data?: { id?: string } } | null;
  return { ok: true, mode: "api", externalId: body?.data?.id };
}

/**
 * Publish one channel. Returns mode:"manual" (caller stages it for a human) when
 * the channel isn't fully configured — that is the normal, non-error path, so a
 * partially-configured channel (token but no id) stages rather than erroring.
 */
export async function publishToChannel(channel: ChannelId, post: PublishablePost): Promise<PublishResult> {
  const creds = await resolveCredentials(channel);
  if (!creds) return { ok: true, mode: "manual" };
  try {
    return await apiPublish(channel, post, creds);
  } catch (err) {
    return { ok: false, mode: "api", error: err instanceof Error ? err.message : "publish failed" };
  }
}

/** The exact text a human should copy when posting a channel manually. */
export function copyText(post: PublishablePost): string {
  const body = composeText(post.caption, post.hashtags);
  return post.link ? `${body}\n\n${post.link}` : body;
}

// ── Connection testing (read-only; never posts) ───────────────────────────────

export type ChannelStatus = { channel: ChannelId; mode: "api" | "manual"; ok: boolean; detail: string };

// Read-only GET against Meta Graph to confirm a token/id resolves to an account.
async function metaGet(url: string, field: string): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error reaching Meta" };
  }
  const text = await res.text().catch(() => "");
  if (!res.ok) return { ok: false, error: `Meta API ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}` };
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    return { ok: true, value: String(body[field] ?? body.id ?? "connected") };
  } catch {
    return { ok: false, error: "unexpected Meta response" };
  }
}

/**
 * Verify a channel's credentials WITHOUT publishing. Unconfigured channels report
 * manual mode; configured Meta channels resolve the account name/username so the
 * admin sees exactly which account they'd post to.
 */
export async function verifyChannel(channel: ChannelId): Promise<ChannelStatus> {
  const creds = await resolveCredentials(channel);
  if (!creds) {
    return { channel, mode: "manual", ok: true, detail: "Manual mode — not connected. Posts are staged to push by hand." };
  }
  const token = creds.token;
  if (channel === "facebook") {
    const r = await metaGet(`${META_GRAPH}/${creds.accountId}?fields=name&access_token=${encodeURIComponent(token)}`, "name");
    return r.ok ? { channel, mode: "api", ok: true, detail: `Connected to Page “${r.value}”.` } : { channel, mode: "api", ok: false, detail: r.error };
  }
  if (channel === "instagram") {
    const r = await metaGet(`${META_GRAPH}/${creds.accountId}?fields=username&access_token=${encodeURIComponent(token)}`, "username");
    return r.ok ? { channel, mode: "api", ok: true, detail: `Connected to @${r.value}.` } : { channel, mode: "api", ok: false, detail: r.error };
  }
  if (channel === "linkedin") {
    return { channel, mode: "api", ok: true, detail: `Configured — posting as ${creds.authorUrn}.` };
  }
  if (channel === "x") {
    try {
      const res = await fetch("https://api.x.com/2/users/me", { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) return { channel, mode: "api", ok: false, detail: `X API ${res.status}` };
      const body = (await res.json().catch(() => null)) as { data?: { username?: string } } | null;
      return { channel, mode: "api", ok: true, detail: body?.data?.username ? `Connected to @${body.data.username}.` : "Token accepted." };
    } catch (err) {
      return { channel, mode: "api", ok: false, detail: err instanceof Error ? err.message : "network error reaching X" };
    }
  }
  if (channel === "threads") {
    const r = await metaGet(`${THREADS_GRAPH}/${creds.accountId}?fields=username&access_token=${encodeURIComponent(token)}`, "username");
    return r.ok ? { channel, mode: "api", ok: true, detail: `Connected to @${r.value}.` } : { channel, mode: "api", ok: false, detail: r.error };
  }
  return { channel, mode: "api", ok: true, detail: "Token present — no read-check implemented for this channel yet." };
}
