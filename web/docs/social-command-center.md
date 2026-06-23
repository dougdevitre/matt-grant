# Social Command Center — operator & developer guide

The admin-only Social Command Center (`/dashboard/social`) lets the campaign compose once and publish to every channel, schedule a calendar of posts, stage media in S3, and optimize each profile for awareness + conversion. This doc covers the schema, how publishing works, how to turn on auto-publish per platform, and the compliance guardrails.

> **Educational information, not legal advice.** The FEC rules summarized here are verified as of the date noted; confirm with a campaign-finance attorney before relying on them.

## Access

Admin-only via the RBAC capability `manageSocial` (`lib/rbac.ts`). Captains, members, supporters, and partners cannot see the page, the sidebar link, or call the server actions — `lib/rbac.test.ts` asserts this. The page itself calls `requireCap("manageSocial")`, so it never relies on the hidden sidebar link for security.

## Pieces

| File | Role |
|---|---|
| `lib/social/channels.ts` | Per-channel schema — char limits, hashtag norms, image specs, best-time windows. One source of truth the composer and optimizer both read. |
| `lib/social/optimize.ts` | Pure engine: `scoreContent()` grades a draft against a channel; `analyzeChannel()` / `footprintScore()` turn analytics into insights + a dominance index. Unit-tested, no I/O. |
| `lib/social/schedule.ts` | DynamoDB store (partition `SOCIALPOST`) + `drainDue()` worker. Claim-before-publish so overlapping cron runs never double-post. |
| `lib/social/scheduler.ts` | Best-time auto-scheduler — timezone-correct (America/Chicago) planner that lays N posts onto each channel's optimal windows. Powers the "Fill the week" panel. |
| `lib/social/publish.ts` | Per-channel publishing adapters + `resolveCredentials()` (OAuth connection → manual token fallback) with graceful degradation. |
| `lib/social/credentials.ts` | Reads the OAuth *app* credentials from `/mattgrant/prod/social/<platform>/<field>`. |
| `lib/social/connections.ts` | DynamoDB store (`SOCIALAUTH`) for per-account OAuth tokens from the connect flow. |
| `lib/social/metaOAuth.ts` | Meta (FB+IG) OAuth: authorize URL + code→long-lived-token→Page/IG exchange + refresh + multi-Page. |
| `lib/social/oauth/` | Provider registry (`index.ts`) + per-provider modules (`facebook.ts`, `x.ts`, `linkedin.ts`, `youtube.ts`), shared `types.ts`, and `refresh.ts` (refresh-on-read + cron backstop). |
| `lib/social/video.ts` | Renders the still graphic → a short vertical MP4 (static ffmpeg) for the YouTube Shorts upload. |
| `app/api/social/{connect,callback}/[platform]` | Platform-agnostic OAuth routes (admin-only; CSRF state + PKCE verifier cookies). |
| `app/api/cron/social-drain/route.ts` | Background worker that publishes scheduled posts at their time. Same `CRON_SECRET` + cadence as the email drain. |
| `app/dashboard/social/{page,actions}.tsx` | The UI + server actions (schedule / post now / cancel / confirm-posted / analyze profile). |
| `components/dashboard/Social*.tsx` | Composer (live per-channel scoring), Profile Optimizer, copy button. |

## Channel schema (verified 2026-06-22)

Caption limits, hashtag norms, and image specs live in `CHANNELS`. Highlights:

| Channel | Max chars | Feed truncates at | Rec. hashtags | API auto-publish |
|---|---|---|---|---|
| X (Twitter) | 280 | 280 | 1–2 | ✅ implemented (text + image) |
| Facebook | 5,000 | 250 | 0–2 | ✅ implemented (text + photo) |
| Instagram | 2,200 | 125 | 3–5 (max 30) | ✅ implemented (image required) |
| LinkedIn | 3,000 | 210 | 3–5 | ✅ implemented (text/link) |
| TikTok | 4,000 | 100 | 3–5 | ✅ implemented (video, or PHOTO post from the graphic) |
| YouTube (Shorts) | 5,000 (desc) | 100 | 2–3 | ✅ implemented (resumable video upload; image-only posts stage) |
| Threads | 500 | 500 | 0–1 | ✅ implemented (text + image) |

These move — re-verify against each platform's current docs and update `CHANNELS` (the staleness convention from `compliance-baseline.md`). Sources used: Glow Social / TypeCount / Letter Counter 2026 character-limit guides.

## Publishing: API mode vs. manual mode

> **Turning on live auto-posting?** See the step-by-step [go-live runbook](./social-go-live.md) — platform app setup, the exact Parameter Store commands, IAM, and the connect/verify walkthrough.

Like SES, Clerk, and S3 elsewhere in the app, publishing **degrades gracefully**:

- **API mode** — when a channel has credentials (an OAuth connection, or a manual token fallback), `drainDue()` posts it automatically through that platform's API at the scheduled time.
- **Manual mode** — otherwise the post is **staged** at its scheduled time and surfaces in the "Ready to post" queue with copy-ready text + the attached image, exactly like Buffer's "reminder" posts for platforms without a publish API. An admin pushes it and clicks **Mark posted**.

### Getting credentials: two ways

`resolveCredentials(channel)` (in `publish.ts`) checks, in order: (1) a stored **OAuth connection**, then (2) a **manual token** fallback in env/SSM.

**1. In-app OAuth connect (recommended — "auth established through the app").** The admin clicks **Connect** on the Channel connections panel. The flow uses the OAuth *app* credentials the campaign loaded into Parameter Store under `/mattgrant/prod/social/<platform>/<field>` (read by `lib/social/credentials.ts`). Providers live in `lib/social/oauth/<provider>.ts` behind a registry (`oauth/index.ts`); the routes `GET /api/social/{connect,callback}/[platform]` are platform-agnostic dispatchers.

- **Facebook (+ Instagram):** Meta OAuth → long-lived user token → the **Page** (its token is what we post with) and the linked **Instagram business account**. One connect powers both channels.
- **X:** OAuth2 **Authorization Code + PKCE** (verifier in a second cookie) → access + refresh token. `offline.access` scope is required for the refresh token.
- **LinkedIn:** OAuth2 (`openid profile w_member_social`) → access token; the author URN is resolved from OpenID `userinfo` (`urn:li:person:{sub}`).
- Connections are stored in DynamoDB (`SOCIALAUTH` partition, `lib/social/connections.ts`). Each platform's registered `redirect_uri` must point at `…/api/social/callback/<platform>`.

**Token refresh:** `resolveCredentials()` calls `ensureFresh()` (`oauth/refresh.ts`) — when a connection is within 7 days of expiry it refreshes + persists the (possibly rotated) token; never throws (degrades to the stale token and surfaces the expiry in the UI). The `/api/cron/social-drain` worker also calls `refreshExpiring()` as a backstop.

**Multi-Page (Meta):** when the account manages several Pages, all are stored and the connections panel shows a "Posting as" picker (`switchPageAction`) — no re-auth needed to switch.

| Channel | Secrets | Notes |
|---|---|---|
| X | `X_ACCESS_TOKEN` | OAuth2 user-context token with `tweet.write` (+ `media.write` for images). Posts text/link and uploads an attached image via the v2 media endpoint. |
| Facebook | `FACEBOOK_PAGE_TOKEN`, `FACEBOOK_PAGE_ID` | Page token with `pages_manage_posts`. Photo post when media attached, else feed post. |
| Instagram | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | IG business/creator account id; token with `instagram_content_publish`. **Image required** (no text-only IG posts). |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` | Author URN (e.g. `urn:li:organization:123`); token with `w_organization_social`/`w_member_social`. Text/link share (image upload is a follow-up). |
| Threads | `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID` | Token with `threads_content_publish`. Same container→publish flow as Instagram, but Threads allows text-only — posts a TEXT thread without a graphic, an IMAGE thread with one. |
| TikTok | `TIKTOK_ACCESS_TOKEN` | Token with the `video.publish` scope (Content Posting API, direct post). A public **video URL** posts as a video; otherwise the on-brand graphic posts as a **PHOTO** (TikTok has no text-only post). Both pull the asset by URL, so the campaign domain must be a **verified URL-prefix property** in the TikTok developer portal. |
| YouTube (Shorts) | `YOUTUBE_ACCESS_TOKEN` | OAuth token with the `youtube.upload` scope. A Short is a **video**, so a post auto-publishes only when it carries a **video URL** (resumable `videos.insert`, privacy `public`); an image-only post honestly **stages for manual posting** rather than faking a video. |

**Video URL.** TikTok and YouTube consume an optional public **video URL** carried on the post (`videoUrl`, set from the composer's "Video URL" field). YouTube needs it to publish at all; TikTok prefers it but falls back to a photo post. `absoluteMediaUrl()` rewrites a relative path against `SITE_URL`, same as images.

**Meta image fetch:** Instagram (and Facebook photo posts) need a **publicly reachable** image. The composer's on-brand graphic is `/api/graphics?…`, which is public; `absoluteMediaUrl()` rewrites it against `SITE_URL` so Meta can fetch it. Override the Graph version with `META_GRAPH_VERSION` as Meta deprecates versions (`THREADS_GRAPH_VERSION` does the same for Threads).

**YouTube video pipeline:** YouTube has no image-post API, so `lib/social/video.ts` renders the composer's still graphic into a short vertical MP4 (held image, 1080×1920, H.264 + silent AAC) using a bundled static **ffmpeg** binary (`@ffmpeg-installer/ffmpeg`), then `publishToYouTube` uploads the bytes via the resumable `videos.insert` flow. `privacyStatus` defaults to `private` (override `YOUTUBE_PRIVACY_STATUS`) since public uploads need Google's `youtube.upload` **app verification** — see `docs/google-youtube-setup.md`. *Operational note:* ffmpeg adds bundle/cold-start/`/tmp` weight to the SSR Lambda (a single-still encode is ~1–3s); if bundle limits bite, move the render to a dedicated Lambda or AWS MediaConvert.

**IAM:** the SSR runtime role must read the new prefix. `infra/setup-aws.sh` grants `ssm:GetParameter` on **both** `…parameter/matt-grant/*` and `…parameter/mattgrant/prod/social/*` (note the hyphen difference); re-run it after loading the params.

**Meta image fetch:** Instagram (and Facebook photo posts) need a **publicly reachable** image. The composer's on-brand graphic is `/api/graphics?…`, which is public; `absoluteMediaUrl()` rewrites it against `SITE_URL` so Meta can fetch it. Override the Graph version with `META_GRAPH_VERSION`.

Channels flip to API mode automatically once connected — no redeploy needed. No tokens are committed; the feature is fully usable day one without any platform credentials.

## Scheduling worker

`drainDue()` mirrors the email drain and is wired by `infra/setup-aws.sh` as the
`matt-grant-social-drain` EventBridge rule (`rate(1 minute)`), hitting:

```
POST https://<host>/api/cron/social-drain
Authorization: Bearer <CRON_SECRET>
```

(Run `CRON_SECRET=… BASE_URL=… bash infra/setup-aws.sh` to provision it alongside
the email drain — Amplify has no native cron.) It claims each due post
(`scheduled → posting`) with a conditional update before publishing, so two
overlapping runs can't double-post. "Post now" in the UI publishes the first item
inline so it goes out immediately.

**Auth (both cron routes):** `POST`-only behind the shared, timing-safe,
fail-closed `cronAuthorized()` gate (`lib/cron-auth.ts`) — the bearer is compared
against `CRON_SECRET`. The `GET` handler was removed to shrink the trigger surface;
EventBridge already invokes via POST (`setup-aws.sh` `--http-method POST`). Per-request
signing/replay nonces aren't used because the EventBridge Connection can only inject a
**static** `Authorization` header, so there's nothing to sign over per request.

## Media / S3

Attaching an **on-brand graphic** uses the existing `/api/graphics` generator (which already bakes the FEC "Paid for by" line) and the same S3 + CloudFront path the Graphics Studio uses. Admins can also paste any public image URL (e.g. an Asset-library CloudFront link). The graphic's `mediaUrl` rides along with the scheduled post and is what API publishers attach / manual posters download.

## Compliance guardrails

- **"Paid for by" disclaimer.** Public campaign communications must carry it. The composer treats an attached on-brand graphic as satisfying this (the image carries the line) and otherwise requires the admin to confirm the disclaimer is in the copy — `scoreContent()` raises an **error** if neither is true. For character-limited formats (X), the FEC's **Adapted Disclaimer** rule allows a shortened sponsor ID plus a link to the full disclaimer when the full text "would occupy more than 25 percent of the communication." *(Verified 2026-06-22 against fec.gov advertising-and-disclaimers guidance and the FEC internet-communications disclaimer rule.)*
- **No fabricated facts.** The content library is the existing 50-post calendar in `lib/socialPosts.ts`, which is faithful to Matt's published platform. The optimizer's thresholds are labeled industry rules of thumb, not Matt-specific data.

> Educational information, not legal advice. Consult a campaign-finance attorney or the FEC for guidance specific to your situation.
