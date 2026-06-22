# Plan — Split About / Issues + a Child Page per Issue

Separate **About Matt** (his story) from **Issues** (the platform), and give each of the four issues a
dedicated child page that carries its graphic, video, argument, commitment, and supporting items.

## 1. Information architecture

Today `/about` mixes bio + issues, and the home "Four Priorities" cards link nowhere. New structure:

```
/about              → Matt's story ONLY (hero, career ledger, values, CTA)
/issues             → index: the Four Priorities overview + infographic, cards → each child page
/issues/family-courts
/issues/term-limits
/issues/smaller-government
/issues/lower-taxes  → one rich child page per issue
```

**Nav change:** replace the single `About Matt / Issues` item with **`About Matt`** (`/about`) and
**`Issues`** (`/issues`). Home's Four Priorities cards become links to each child page.

## 2. Per-issue content model (`lib/issues.ts`)

Extend the current `PRIORITIES` into a richer typed structure (keep `id`/slug, `n`, `title`, `short`):

| Field | Purpose | Source |
|---|---|---|
| `slug`, `n`, `eyebrow`, `title`, `tagline` | identity / hero | existing PRIORITIES + pillar labels |
| `argument` = `{ problem[], solution[] }` | the case: what's wrong → Matt's fix | `candidate/platform.md` (faithful) |
| `commitment` | Matt's pledge, one or two lines | `platform.md` only — no invented pledges |
| `graphic` | hero/share image (CDN) | the per-issue card (below) |
| `video?` | embedded clip (CDN) or null | see asset gaps |
| `gallery[]` | extra share cards | social feed + print renditions |
| `related` = `{ childAct?, coalition?, press?, donate }` | supporting items | existing docs/pages |

## 3. Child-page layout (each `/issues/<slug>`)

1. **Hero** — eyebrow (pillar), title, tagline, the issue graphic (and video if available).
2. **The argument** — "The problem" → "Matt's solution" (two short columns from `platform.md`).
3. **Matt's commitment** — a pull-quote pledge card (faithful to platform).
4. **Signature legislation** *(family-courts only)* — the CHILD Protection Act block + a link to the
   one-pager PDF and the coalition kit; **In the news** strip pulling the press items (pending-case
   framing preserved).
5. **Share / take it with you** — the issue's social card + print rendition (download/share), tying
   into the Media library.
6. **CTA** — Donate / Get involved, and prev/next issue nav.

## 4. Per-issue sourcing (concrete — assets already on the CDN)

| Issue | Graphic (live) | Video | Argument & commitment | Other items |
|---|---|---|---|---|
| **family-courts** | `social/feed/D-47.png` + Four Priorities infographic | `video/mg-video-fixing-missouris-broken-system.mp4` | platform.md §1 + CHILD Act | CHILD Act one-pager, coalition kit, press (RICO, pending) |
| **term-limits** | `social/feed/D-45.png` | ☐ none yet | platform.md §2 (grandfather clause) | print rendition D-45 |
| **smaller-government** | `social/feed/D-44.png` | ☐ none yet | platform.md §3 (hiring freeze, early retirement) | print rendition D-44 |
| **lower-taxes** | `social/feed/D-43.png` | ☐ none yet | platform.md §4 (cut waste first) | print rendition D-43 |

## 5. Asset gaps (honest)

- **Video:** only one content clip exists; it anchors **family-courts**. The other three pages render
  **graphic-only** (no empty player) until issue clips are produced — the model has an optional
  `video` so pages degrade cleanly. Flagged as a production to-do, not faked.
- **Commitments:** taken verbatim-in-spirit from `platform.md`; nothing new invented. Messaging lines
  (e.g., "I'll go first") are campaign-derived and labeled as such, not added to the platform.

## 6. Wiring & cleanup

- `app/(site)/issues/page.tsx` (index) + `app/(site)/issues/[slug]/page.tsx` with
  `generateStaticParams` over the four slugs; per-page `metadata` (title/description/OG = issue graphic).
- Home Four Priorities cards → `/issues/<slug>`; About page **drops** the issues section and keeps a short
  "Where Matt stands → /issues" teaser.
- `NAV` split; update any in-page `#issues` anchors and the `/about` CTA copy.
- Optional redirect: `/about#issues` → `/issues`.

## 7. Faithfulness & guardrails

- Every argument/commitment traces to `candidate/platform.md`; **no new positions, statutes, numbers,
  or pledges.** Only family-courts carries the lawsuit/press, framed as **pending/alleged**.
- Disclaimers/"Paid for by…" stay intact; the issue graphics already carry it.

## 8. Phasing

- **P1:** `lib/issues.ts` data model + routes + the **family-courts** page (richest — graphic, video,
  CHILD Act, coalition, press). Ships the pattern end-to-end.
- **P2:** the other three child pages + the `/issues` index.
- **P3:** rewire nav + home cards + trim the About page (+ redirect).

_Paid for by the Matt Grant for Congress Committee._
