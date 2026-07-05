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
| LinkedIn | 3,000 | 210 | 3–5 | ✅ implemented (text/link + image) |
| TikTok | 4,000 | 100 | 3–5 | ✅ implemented (photo post) |
| YouTube (Shorts) | 5,000 (desc) | 100 | 2–3 | ✅ implemented (Short via still→MP4 render) |
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

**2. Manual token fallback** (env/SSM flat names under `/matt-grant/<NAME>`): `X_ACCESS_TOKEN`; `FACEBOOK_PAGE_TOKEN`+`FACEBOOK_PAGE_ID`; `INSTAGRAM_ACCESS_TOKEN`+`INSTAGRAM_USER_ID`; `LINKEDIN_ACCESS_TOKEN`+`LINKEDIN_AUTHOR_URN`; `THREADS_ACCESS_TOKEN`+`THREADS_USER_ID`; `YOUTUBE_ACCESS_TOKEN`. Useful for testing. Threads has no in-app OAuth connect yet, so it uses this fallback only.

| Channel | Connect flow | Posts | Scopes |
|---|---|---|---|
| Facebook | ✅ Meta OAuth (+ refresh, multi-Page) | photo (media attached) / feed | `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` |
| Instagram | ✅ via the Meta connect | image required (container→publish) | `instagram_basic`, `instagram_content_publish` |
| X | ✅ OAuth2 + PKCE (+ refresh) | text/link + image (v2 media) | `tweet.read tweet.write users.read offline.access` |
| LinkedIn | ✅ OAuth2 (member; + image upload) | text/link + image (register-upload) | `openid profile w_member_social` |
| Threads | manual token only (no OAuth yet) | text + image (container→publish) | `threads_basic`, `threads_content_publish` |
| TikTok | ✅ OAuth2 + PKCE (+ refresh) | **photo post** (pulls the graphic by URL) | `user.info.basic,video.publish` |
| YouTube | ✅ Google OAuth2 + PKCE (+ refresh) | **Short** (still→MP4 render, resumable upload) | `youtube.upload` (+ `openid email`) |

**TikTok gates:** public `DIRECT_POST` requires the app to pass TikTok's **content-posting audit** and the pull-URL host (the site domain) to be **URL-prefix verified** in the TikTok developer portal. Until audited, posts must be `SELF_ONLY` — the adapter defaults `privacy_level` to `SELF_ONLY`, overridable via `TIKTOK_PRIVACY_LEVEL` once approved. TikTok pulls the public `/api/graphics` image, so no media is uploaded from our side.

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

Attaching an **on-brand graphic** uses the existing `/api/graphics` generator (which already bakes the FEC "Paid for by" line) and the same S3 + CloudFront path the Graphics Studio uses. The graphic's `mediaUrl` rides along with the scheduled post and is what API publishers attach / manual posters download.

### Media picker — one picker over the whole media center

Instead of the auto graphic, the composer can pull an image from **all three media-center surfaces** through one tabbed picker (`components/dashboard/AssetPicker.tsx`):

| Tab | Source | Postable as-is? |
|---|---|---|
| **Assets** | Public images from `/api/assets/list` | ✅ stable CloudFront URL |
| **Studio** | The tagged subset of public assets the Graphics Studio saves (tag `studio`, or the legacy `matt-grant-*` name) — see `isStudioGraphic()` | ✅ same |
| **Photos** | The private shoot library (`/api/assets/photos`) | ❌ promoted on select (below) |

Only **public images** are valid post media directly: private assets and photos are served via short-lived presigned URLs that **expire before a scheduled `drainDue()` fires** and that social networks can't fetch. `isPublicImage()` (`lib/social/assetMedia.ts`) is the filter for the Assets/Studio tabs.

### Photo promote-on-select

Picking a **private photo** publishes a **stable public copy** so it becomes postable — `POST /api/assets/promote` → `promoteToPublicImage()` (`lib/social/promoteMedia.ts`):

- Copies the private object to a **deterministic** public key (`publicSocialKey()`: `private/photos/events/a.jpg → public/social/photos-events-a.jpg`), so re-promoting the same photo overwrites the same object instead of duplicating it.
- **Web-safes + optimizes** the bytes (`toWebSafeImage()` in `lib/images.ts`): multi-MB masters are downscaled to platform limits and HEIC/TIFF phone photos are transcoded to JPEG (extension adjusted to match).
- Records the copy in the asset library (tags `social`, `photo`) so it also shows up under Assets.
- **The original photo stays private** — only the public copy is created. Gated on `manageSocial` (admin-only), the tightest cap, since it makes staff-only media public; the picker shows a "permanent public copy" note.
- **Taking it back down:** the copy is a normal public asset (tagged `social`, `photo`), so it can be deleted from the Assets page — **Delete** removes the S3 object + metadata via `POST /api/assets/delete` (`manageAssets`, with a confirm). Deletion doesn't touch the private original.

Any picked image that isn't the auto on-brand graphic still trips the "Paid for by disclaimer" acknowledgment in `scoreContent()` — promoted photos included.

### Recent-media rail

The composer's Image card shows a one-click **Recent** rail (`components/dashboard/RecentMedia.tsx`) of the newest post-ready images from `/api/assets/list` (public images only, newest-first). It's the fast path for the common case — reuse the graphic you just saved, or a recent upload — without opening the picker. Selecting a thumbnail runs the same select handler as the picker (turns off the auto graphic, highlights the active tile). Silent until loaded and when empty.

### Studio → Social hand-off

The Graphics studio's **"Use in a post"** button (`StudioForm`, shown after Save to library) deep-links to `/dashboard/social?mediaKey=…&mediaUrl=…&mediaName=…`. The social page sanitizes those params (`sanitizeMediaUrl` + a `public/` key check) and passes them to the composer as `initialMedia`, which pre-selects the graphic with the auto on-brand graphic turned off. `schedulePost` re-sanitizes on submit as a second gate.

### Social → Studio hand-off (round-trip)

The composer's **"or make a graphic in Studio"** link deep-links to `/dashboard/studio?headline=…&sub=…`, prefilled with the caption's first line as the headline. `StudioForm` reads those params as its initial `headline`/`sub`/`format`. Craft the graphic, Save to library, then click **"Use in a post"** to land back in the composer with it attached — the two hand-offs chain into a full round-trip.

## Compliance guardrails

- **"Paid for by" disclaimer.** Public campaign communications must carry it. The composer treats an attached on-brand graphic as satisfying this (the image carries the line) and otherwise requires the admin to confirm the disclaimer is in the copy — `scoreContent()` raises an **error** if neither is true. For character-limited formats (X), the FEC's **Adapted Disclaimer** rule allows a shortened sponsor ID plus a link to the full disclaimer when the full text "would occupy more than 25 percent of the communication." *(Verified 2026-06-22 against fec.gov advertising-and-disclaimers guidance and the FEC internet-communications disclaimer rule.)*
- **No fabricated facts.** The content library is the existing 50-post calendar in `lib/socialPosts.ts`, which is faithful to Matt's published platform. The optimizer's thresholds are labeled industry rules of thumb, not Matt-specific data.

> Educational information, not legal advice. Consult a campaign-finance attorney or the FEC for guidance specific to your situation.
