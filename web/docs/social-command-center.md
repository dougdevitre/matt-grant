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
| `lib/social/publish.ts` | Per-channel publishing adapters with graceful degradation (API mode vs. manual mode). |
| `app/api/cron/social-drain/route.ts` | Background worker that publishes scheduled posts at their time. Same `CRON_SECRET` + cadence as the email drain. |
| `app/dashboard/social/{page,actions}.tsx` | The UI + server actions (schedule / post now / cancel / confirm-posted / analyze profile). |
| `components/dashboard/Social*.tsx` | Composer (live per-channel scoring), Profile Optimizer, copy button. |

## Channel schema (verified 2026-06-22)

Caption limits, hashtag norms, and image specs live in `CHANNELS`. Highlights:

| Channel | Max chars | Feed truncates at | Rec. hashtags | API auto-publish |
|---|---|---|---|---|
| X (Twitter) | 280 | 280 | 1–2 | ready to wire |
| Facebook | 5,000 | 250 | 0–2 | ready to wire |
| Instagram | 2,200 | 125 | 3–5 (max 30) | ready to wire |
| LinkedIn | 3,000 | 210 | 3–5 | manual |
| TikTok | 4,000 | 100 | 3–5 | manual |
| YouTube (Shorts) | 5,000 (desc) | 100 | 2–3 | manual |
| Threads | 500 | 500 | 0–1 | manual |

These move — re-verify against each platform's current docs and update `CHANNELS` (the staleness convention from `compliance-baseline.md`). Sources used: Glow Social / TypeCount / Letter Counter 2026 character-limit guides.

## Publishing: API mode vs. manual mode

Like SES, Clerk, and S3 elsewhere in the app, publishing **degrades gracefully**:

- **API mode** — when a channel's access token is present (read via `getSecret`), `drainDue()` posts it automatically through that platform's API at the scheduled time.
- **Manual mode** — with no token, the post is **staged** at its scheduled time and surfaces in the "Ready to post" queue with copy-ready text + the attached image, exactly like Buffer's "reminder" posts for platforms without a publish API. An admin pushes it and clicks **Mark posted**.

### Turning on auto-publish for a channel

1. Create the platform app / get a long-lived access token for the committee account.
2. Store it in SSM at `/matt-grant/<TOKEN>` (SecureString) — e.g. `X_ACCESS_TOKEN`, `FACEBOOK_PAGE_TOKEN`, `INSTAGRAM_ACCESS_TOKEN`, `LINKEDIN_ACCESS_TOKEN`, `TIKTOK_ACCESS_TOKEN`, `YOUTUBE_ACCESS_TOKEN`, `THREADS_ACCESS_TOKEN`. (Token env names live in `publish.ts`.)
3. Implement the platform call in `apiPublish()` in `lib/social/publish.ts` (it currently fails loudly rather than silently dropping a post the admin thinks went out).
4. The channel flips to API mode automatically — no redeploy needed (SSM TTL is ~5 min).

No tokens are committed. Absence = manual mode; the feature is fully usable day one without any platform credentials.

## Scheduling worker

`drainDue()` mirrors the email drain. Point an EventBridge Scheduler (~every minute) at:

```
POST https://<host>/api/cron/social-drain
Authorization: Bearer <CRON_SECRET>
```

It claims each due post (`scheduled → posting`) with a conditional update before publishing, so two overlapping runs can't double-post. "Post now" in the UI publishes the first item inline so it goes out immediately.

## Media / S3

Attaching an **on-brand graphic** uses the existing `/api/graphics` generator (which already bakes the FEC "Paid for by" line) and the same S3 + CloudFront path the Graphics Studio uses. Admins can also paste any public image URL (e.g. an Asset-library CloudFront link). The graphic's `mediaUrl` rides along with the scheduled post and is what API publishers attach / manual posters download.

## Compliance guardrails

- **"Paid for by" disclaimer.** Public campaign communications must carry it. The composer treats an attached on-brand graphic as satisfying this (the image carries the line) and otherwise requires the admin to confirm the disclaimer is in the copy — `scoreContent()` raises an **error** if neither is true. For character-limited formats (X), the FEC's **Adapted Disclaimer** rule allows a shortened sponsor ID plus a link to the full disclaimer when the full text "would occupy more than 25 percent of the communication." *(Verified 2026-06-22 against fec.gov advertising-and-disclaimers guidance and the FEC internet-communications disclaimer rule.)*
- **No fabricated facts.** The content library is the existing 50-post calendar in `lib/socialPosts.ts`, which is faithful to Matt's published platform. The optimizer's thresholds are labeled industry rules of thumb, not Matt-specific data.

> Educational information, not legal advice. Consult a campaign-finance attorney or the FEC for guidance specific to your situation.
