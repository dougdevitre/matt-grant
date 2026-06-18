# Content Operations Plan — Organizing a Winning Campaign's Assets

How the campaign stores, names, and produces **every type** of content — so anything (a graphic, a
mailer, a video, a one-pager) is easy to find, on-brand, and ready to deploy.

## 0. Asset store (migrated)

Assets live in one S3 bucket, **`matt-grant-for-congress`** (renamed from the account-numbered bucket;
versioning + encryption on, public access blocked), served publicly through **CloudFront**
(`d5jzyan9wboi3.cloudfront.net`) via Origin Access Control — the bucket stays private, the CDN is
public. The old bucket is retained as a backup and can be deleted once you're satisfied.

## 1. Folder structure (the home for each content type)

```
public/                         # CDN-served (anyone can download via CloudFront)
├── brand/                      # logo (color/navy/red/white, PNG + SVG), headshot, icons, color/font specs
├── marketing/                  # infographics, banners, one-pagers, the campaign deck
├── social/
│   ├── feed/                   # 1080x1080 square posts
│   ├── stories/                # 1080x1920 stories / reels covers
│   └── captions/               # manifest.json, INDEX.md (the content calendar)
├── video/                      # short clips + thumbnails (host long video on YouTube; link here)
├── print/                      # yard signs, mailers, palm cards, posters (print-ready PDFs)
└── web/                        # hero images, OG cards, banner ads
private/                        # staff-only (signed URLs)
├── raw/                        # full-res originals: headshots, vector logo source, RAW photos
├── photos/                     # tagged event/candidate/district photo library
└── exports/                    # working files, drafts, donor exports
```

## 2. Naming convention

Lowercase, hyphen-separated, descriptive, with dimensions for sized art:

```
mg-<category>-<topic>-<descriptor>-<WxH>.<ext>
```

| Example | Meaning |
|---|---|
| `mg-brand-logo-navy.svg` | navy logo, vector |
| `mg-social-termlimits-quote-1080x1080.png` | square quote card, term-limits |
| `mg-social-gotv-countdown-d07-1080x1920.png` | story, 7-days-out GOTV |
| `mg-print-yardsign-childrenfirst-24x18.pdf` | 24×18 yard sign |
| `mg-video-ad-familycourt-30s.mp4` | 30-second family-court ad |
| `mg-marketing-fourfights-infographic-1920x1080.png` | the Four Fights infographic |

Rules: no spaces, no capitals, no account IDs; date GOTV items `d07`/`d01`; keep the **original**
high-res in `private/raw/` and only put export-ready files in `public/`.

## 3. Content types a winning campaign needs (production checklist)

| Category | What to produce | Status |
|---|---|---|
| **Brand kit** | Logo (4 variants, PNG **+ SVG**), 300-DPI headshot, color/font spec, social avatars, favicon | ◐ logo + headshot (need SVG + 300-DPI photo) |
| **Social** | Feed squares, **stories (1080×1920)**, reels covers, profile + cover banners per platform | ◑ 50 feed + 50 stories + 50 captions done; platform banners next |
| **Video** | Launch video, 15/30/60s ads, testimonials, town-hall clips, CHILD-Act explainer, b-roll | ☐ |
| **Print** | Yard signs, large signs, **3–4 mailers**, door hangers, palm cards, posters, business cards, petition/volunteer forms | ☐ |
| **Digital ads** | Creative at 1200×628, 1080×1080, 1080×1920, 300×250, 728×90 + ad copy | ☐ |
| **Web / email** | Hero images, OG share cards, email header/footer, banner ads | ◑ OG card done |
| **Documents** | Campaign deck, **issue one-pager per pillar**, press releases, endorsement cards, bio sheet, policy briefs | ◑ deck + infographic done |
| **Photo library** | Candidate, family, events, district, b-roll — tagged, in `private/photos/` | ☐ |
| **Copy library** | Captions (50 ✓), stump speech, talking points, FAQ, donor + volunteer scripts | ◑ |

## 4. Workflow — adding new content

1. **Drop the original** in `private/raw/` (keep the source).
2. **Export** to the right size(s), name per the convention, upload to the matching `public/` folder.
3. For social posts, add the entry to `web/lib/socialPosts.ts` (and re-export `manifest.json`).
4. New `public/` files are instantly live on the CDN; the Media page can index them.

## 5. Next priorities (highest leverage)

1. **Stories set (1080×1920)** of the 50 posts — for IG/FB Stories & Reels covers.
2. **Print kit** — yard sign + palm card + one mailer (the workhorses of a primary).
3. **A 30-second launch/ad video** + the CHILD-Act explainer.
4. **High-res headshot + vector logo** into `private/raw/`, then regenerate the brand kit crisp.

_Paid for by the Matt Grant for Congress Committee._
