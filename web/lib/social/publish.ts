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
import { composeText, type ChannelId } from "@/lib/social/channels";

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

// The secret name that, when present, switches a channel from manual → API mode.
const TOKEN_ENV: Record<ChannelId, string> = {
  x: "X_ACCESS_TOKEN",
  facebook: "FACEBOOK_PAGE_TOKEN",
  instagram: "INSTAGRAM_ACCESS_TOKEN",
  linkedin: "LINKEDIN_ACCESS_TOKEN",
  tiktok: "TIKTOK_ACCESS_TOKEN",
  youtube: "YOUTUBE_ACCESS_TOKEN",
  threads: "THREADS_ACCESS_TOKEN",
};

/** True if this channel has credentials wired for direct API publishing. */
export async function channelConfigured(channel: ChannelId): Promise<boolean> {
  try {
    return !!(await getSecret(TOKEN_ENV[channel]));
  } catch {
    return false;
  }
}

// Per-channel API senders. These are only reached when a token is present, so the
// default deployment never calls them. X is the reference adapter (a real X API v2
// call); the others fail loudly until wired so a post the admin believes went out
// via API is never silently dropped.
async function apiPublish(channel: ChannelId, post: PublishablePost, token: string): Promise<PublishResult> {
  if (channel === "x") return publishToX(post, token);
  return { ok: false, mode: "api", error: `Auto-publish for ${channel} is not implemented yet — post manually or remove its ${TOKEN_ENV[channel]}.` };
}

// Reference adapter: post text to X via API v2 (POST /2/tweets with an OAuth2
// user-context Bearer token that has tweet.write scope). Media upload is a
// separate, OAuth1.0a/v2-media flow not wired here — if the post has an image,
// the link/caption still goes out and the admin attaches media in-app. Keeping
// the contract honest: a non-2xx response surfaces as a failure, not a silent OK.
async function publishToX(post: PublishablePost, token: string): Promise<PublishResult> {
  const text = copyText(post);
  let res: Response;
  try {
    res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ text }),
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
 * the channel has no API token — that is the normal, non-error path.
 */
export async function publishToChannel(channel: ChannelId, post: PublishablePost): Promise<PublishResult> {
  const token = await getSecret(TOKEN_ENV[channel]).catch(() => null);
  if (!token) return { ok: true, mode: "manual" };
  try {
    return await apiPublish(channel, post, token);
  } catch (err) {
    return { ok: false, mode: "api", error: err instanceof Error ? err.message : "publish failed" };
  }
}

/** The exact text a human should copy when posting a channel manually. */
export function copyText(post: PublishablePost): string {
  const body = composeText(post.caption, post.hashtags);
  return post.link ? `${body}\n\n${post.link}` : body;
}
