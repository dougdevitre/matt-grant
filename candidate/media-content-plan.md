# Media & Social Content Plan

How the campaign turns brand assets into a repeatable, voter-targeted content engine — a public
**Media page** for downloads + sharing, a **50-post daily calendar** to August 4, an **S3 content
library**, and a path to **automated posting** (API / connector / MCP).

> Integrity: every post reflects Matt's published platform, never names or attacks the opponent, and
> carries no fabricated quotes/stats/endorsements. Public posts keep the verbatim "Paid for by Matt
> Grant for Congress." line.

## 1. What's built (live)

- **Public Media page** (`/media`) — downloads the brand assets (logo variants, headshot, the *Four
  Priorities* infographic, the *New Standard of Service* banner, the campaign deck) and renders the
  50-post calendar with **Copy caption**, **Share to X**, **Share to Facebook**, **Square ↓**
  (1080×1080 feed), and **Story ↓** (1080×1920).
- **`lib/socialPosts.ts`** — the typed index of 50 posts (the source of truth; also exported to S3).
- **S3 content library** — `s3://matt-grant-for-congress/public/social/` (`feed/`, `stories/`,
  `captions/manifest.json`, `captions/INDEX.md`).

## 2. Content taxonomy (every post is tagged)

- **Pillars:** Children First · Term Limits · Smaller Government · Lower Taxes · Bio & Values ·
  Contrast · GOTV · Coalition · Faith & Community.
- **Voter personas:** Parents & families · Seniors · Small-business owners · Faith community ·
  Veterans · Young voters · Suburban women · Fiscal conservatives · Rural/new-map county voters ·
  First-time primary voters.
- **Coalitions/alliances:** Parents/PTA · Scouting families · Chambers of commerce · Faith leaders ·
  Veterans groups · Taxpayer/term-limit advocates · Legal/justice reform · Neighborhood captains.

## 3. The 50-post countdown calendar

One post per day, **D-50 → D-1**, an arc that: introduces Matt (bio/values) → builds the four
priorities → activates coalitions & personas → intensifies **GOTV** in the final ~10 days. Each item has
caption, hashtags, channel(s), persona, coalition, CTA, and a suggested graphic. Post one a day.

## 4. S3 content library structure

```text
s3://matt-grant-for-congress/public/social/
├── feed/             # 1080×1080 square posts: D-50.png … D-1.png
├── stories/          # 1080×1920 story/reel covers: D-50.png … D-1.png
└── captions/
    ├── manifest.json # the 50 posts (machine-readable; the Media page / API read this)
    └── INDEX.md      # human-readable index
```

Add a post's artwork by generating it with `web/scripts/generate-social-graphics.mjs` (or the
**/dashboard/studio**), then uploading to `public/social/feed/<id>.png` and
`public/social/stories/<id>.png` — the Media page's **Square ↓** / **Story ↓** links pick them up
automatically.

## 5. Posting integration — phased

| Phase | How it posts | Needs |
|---|---|---|
| **1 — Share (live)** | Native share intents (X compose, Facebook sharer) + copy-caption + download. The person posts to their own channel. | nothing |
| **2 — Auto-publish** | A `/api/social/publish` route + scheduler (EventBridge → the day's post) posting to all channels via one social API. **Recommend [Ayrshare](https://www.ayrshare.com/)** (single key → X/Facebook/Instagram/LinkedIn/TikTok) or Buffer/Metricool. | one API key + connected accounts |
| **3 — Agent / MCP** | An MCP server (or the get-elected skill) that drafts from the calendar and schedules via the Phase-2 API, so staff can say "queue this week." | Phase 2 + an MCP endpoint |

**Recommendation:** ship Phase 1 (done), add **Ayrshare** for Phase 2 when accounts are connected —
it's the lowest-effort way to "post to your favorite channel through an API." Phase 3 layers an
agent/MCP on top of the same API.

## 6. Asset index

The canonical index is **`web/lib/socialPosts.ts`** (50 posts) + **`BRAND_DOWNLOADS`** in
`web/lib/site.ts` (downloadable artwork). Both are mirrored to `public/social/manifest.json` in S3
for the API/MCP to consume. Regenerate the manifest after editing the posts.

_Paid for by Matt Grant for Congress._
