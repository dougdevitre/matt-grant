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
| `lib/social/publish.ts` | Per-channel publishing adapters with graceful degradation (API mode vs. manual mode). |
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
| TikTok | 4,000 | 100 | 3–5 | manual (stub) |
| YouTube (Shorts) | 5,000 (desc) | 100 | 2–3 | manual (stub) |
| Threads | 500 | 500 | 0–1 | manual (stub) |

These move — re-verify against each platform's current docs and update `CHANNELS` (the staleness convention from `compliance-baseline.md`). Sources used: Glow Social / TypeCount / Letter Counter 2026 character-limit guides.

## Publishing: API mode vs. manual mode

Like SES, Clerk, and S3 elsewhere in the app, publishing **degrades gracefully**:

- **API mode** — when a channel is **fully configured** (all its required secrets present, read via `getSecret`), `drainDue()` posts it automatically through that platform's API at the scheduled time.
- **Manual mode** — otherwise the post is **staged** at its scheduled time and surfaces in the "Ready to post" queue with copy-ready text + the attached image, exactly like Buffer's "reminder" posts for platforms without a publish API. An admin pushes it and clicks **Mark posted**. A channel with a token but a missing id stages (not errors).

### Required secrets per channel

Store each in SSM at `/matt-grant/<NAME>` (SecureString). A channel auto-publishes only when **all** of its secrets are present.

| Channel | Secrets | Notes |
|---|---|---|
| X | `X_ACCESS_TOKEN` | OAuth2 user-context token with `tweet.write` (+ `media.write` for images). Posts text/link and uploads an attached image via the v2 media endpoint. |
| Facebook | `FACEBOOK_PAGE_TOKEN`, `FACEBOOK_PAGE_ID` | Page token with `pages_manage_posts`. Photo post when media attached, else feed post. |
| Instagram | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` | IG business/creator account id; token with `instagram_content_publish`. **Image required** (no text-only IG posts). |
| LinkedIn | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` | Author URN (e.g. `urn:li:organization:123`); token with `w_organization_social`/`w_member_social`. Text/link share, plus image shares via the register-upload (asset) flow when a graphic is attached. |
| TikTok / YouTube / Threads | `<PLATFORM>_ACCESS_TOKEN` | Adapter not implemented yet — stages manually until wired in `apiPublish()`. |

**Meta image fetch:** Instagram (and Facebook photo posts) need a **publicly reachable** image. The composer's on-brand graphic is `/api/graphics?…`, which is public; `absoluteMediaUrl()` rewrites it against `SITE_URL` so Meta can fetch it. Override the Graph version with `META_GRAPH_VERSION` as Meta deprecates versions.

Channels flip to API mode automatically once their secrets land — no redeploy needed (SSM TTL is ~5 min). No tokens are committed; the feature is fully usable day one without any platform credentials.

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

## Media / S3

Attaching an **on-brand graphic** uses the existing `/api/graphics` generator (which already bakes the FEC "Paid for by" line) and the same S3 + CloudFront path the Graphics Studio uses. Admins can also paste any public image URL (e.g. an Asset-library CloudFront link). The graphic's `mediaUrl` rides along with the scheduled post and is what API publishers attach / manual posters download.

## Compliance guardrails

- **"Paid for by" disclaimer.** Public campaign communications must carry it. The composer treats an attached on-brand graphic as satisfying this (the image carries the line) and otherwise requires the admin to confirm the disclaimer is in the copy — `scoreContent()` raises an **error** if neither is true. For character-limited formats (X), the FEC's **Adapted Disclaimer** rule allows a shortened sponsor ID plus a link to the full disclaimer when the full text "would occupy more than 25 percent of the communication." *(Verified 2026-06-22 against fec.gov advertising-and-disclaimers guidance and the FEC internet-communications disclaimer rule.)*
- **No fabricated facts.** The content library is the existing 50-post calendar in `lib/socialPosts.ts`, which is faithful to Matt's published platform. The optimizer's thresholds are labeled industry rules of thumb, not Matt-specific data.

> Educational information, not legal advice. Consult a campaign-finance attorney or the FEC for guidance specific to your situation.
