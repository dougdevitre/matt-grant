# Visual Design Plan — Imagery for Every Page

Goal: make each page and section more visually appealing by placing real campaign imagery where
there's currently text-on-white. We already have a deep asset bank on the CDN; today the site uses
only the headshot/portrait + the hero video. This plan maps **every section → an image → a source →
a treatment**, plus the technical enablement and an honest note on authenticity.

## 0. What we have to work with

| Bank (on CDN `…/public/…`) | Pieces | Best used as |
|---|---|---|
| `brand/` portraits (local `public/brand/portrait-*`) | 400/800/1200 + og-card | hero portraits (in use) |
| `marketing/infographic.png` | the *Four Fights* infographic | platform/issues band |
| `marketing/banner-standard-of-service.png` | wide brand banner | page headers / donate |
| `marketing/flyers/*` | 16 navy "scene" flyers (1536×1024) | section bands, donate, cards |
| `marketing/deck/mandate/page-*.jpg` | 12 deck slides | about/story dividers |
| `web/st-louis-arch.png` | St. Louis Arch brand scene | district bands / CTAs |
| `web/dashboard-*.png` | 2 "war room" mockups | dashboard/internal only |
| `social/feed/*`, `print/walgreens/*` | 50 + 36 quote cards | collage strips |
| `video/*` | 3 clips | hero (in use), about |

**Authenticity caveat:** the flyers, arch, deck, and dashboard images are *branded/AI scenes*, great as
decorative texture but **not** documentary photos of real people or events. The single highest-impact
upgrade is a **real photo shoot** (Matt in-district, with families, at events) → `private/photos/` →
hand-pick for `public/web/`. Until then, use the brand scenes as atmosphere, never captioned as a real
moment.

## 1. Technical enablement (do first)

- **next/image for CDN assets** — add the CloudFront host to `next.config` `images.remotePatterns`
  so `<Image>` can optimize the flyers/arch/infographic (responsive sizes, lazy-load, AVIF/WebP).
  Local `public/brand/*` already works.
- **One reusable treatment** — a `SectionBand` pattern: full-width image + navy scrim
  (`bg-gradient-to-* from-ink/85`) when text sits on top, `rounded-lg ring-1 shadow-card` when it's a
  framed panel. Mirrors the hero scrim already shipped.
- **Performance & a11y** — `priority` only on the LCP image per page; everything below the fold lazy;
  real `alt` for meaningful images, `aria-hidden` for purely decorative ones.

## 2. Per-page plan

### Home (`/`)
| Section | Today | Add | Source |
|---|---|---|---|
| Hero | video ✓ | a dark poster-frame fallback for first paint | a video still / `og-card` |
| Four Fights (cards) | text cards | a full-width **infographic band** right after the grid | `marketing/infographic.png` |
| Meet Matt | portrait ✓ | — | — |
| Closing CTA | centered text on white | convert to a **full-bleed Arch band** + scrim | `web/st-louis-arch.png` |

### About (`/about`)
| Section | Today | Add | Source |
|---|---|---|---|
| Hero | portrait ✓ | — | — |
| Career ledger (timeline) | text | a side/divider image to break the list | a deck slide or `st-louis-arch` |
| Issues (dark band) | text + cards | the **Four Fights infographic** in the intro | `marketing/infographic.png` |
| CHILD Protection Act card | text | a subtle framed brand panel beside it | a relevant flyer |
| Closing CTA | text | background band + scrim | a flyer scene |

### Donate (`/donate`) — currently the barest page
| Section | Today | Add | Source |
|---|---|---|---|
| Hero | text + amount grid | make it **2-column**: copy left, image right | `banner-standard-of-service` or a flyer |
| Below amounts | text | a "where it goes" reassurance band w/ image | a flyer scene |

### Contact (`/contact`)
| Section | Today | Add | Source |
|---|---|---|---|
| "Donate today" side card | text | a branded image panel | `st-louis-arch` or banner |

### Media (`/media`) — already gallery-rich
- Add a **header banner** above the title for polish. Source: `banner-standard-of-service`.

### Press (`/press`)
- A modest **portrait or "on-camera" framed image** near the PressKit, so the booking section feels
  human. Source: `portrait-800` or `og-card`.

### Print (`/print`) & Press/Schedule
- Optional header banner; low priority (both are already functional/visual).

### Dashboard (`/dashboard/*`) — internal tool
- Lowest priority. Optional: a faint header image on the dashboard home using a `web/dashboard-*`
  mockup. Skip the data pages.

## 3. Phasing

- **Phase 1 (highest impact, ~1 pass):** next/image CDN config + the **Home Closing-CTA Arch band**,
  the **Four Fights infographic band** (home + about issues), and the **Donate 2-column hero image**.
  These hit the emptiest, highest-traffic surfaces.
- **Phase 2:** About career/issue dividers, Contact panel, Media + Press headers.
- **Phase 3 (best quality) — pipeline scaffolded ✅:** the `private/photos/` library
  (candidate/family/events/district/broll) exists with a README; `sync-photos.mjs` ingests a shoot
  privately, `promote-photo.mjs` renders web-optimized derivatives (1600/800/og) to
  `public/web/photos/` and records them in `lib/webPhotos.json`, and `webPhoto(name)` lets a page use
  a real photo with a brand-scene fallback. **Remaining:** an actual photo shoot, then swap
  placeholders for the promoted photos.

## 4. Guardrails

- Keep one bold image per section; don't stack competing scenes.
- Always scrim text-over-image for contrast/legibility; respect `prefers-reduced-motion` for any
  parallax/animation.
- Never imply a branded/AI scene is a real photo (no "at a rally" captions on generated art).
- Disclaimer line stays visible; images never cover the "Paid for by…" footer.

_Paid for by the Matt Grant for Congress Committee._
