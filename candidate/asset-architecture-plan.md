# Asset Architecture Plan — One S3 Source of Truth (AWS Well-Architected)

Goal: make **`s3://matt-grant-for-congress`** the single, authoritative home for *every* campaign
asset — the originals currently sitting in `~/Downloads/grant-assets` **plus** everything generated in
the app — organized, governed, and served per the **AWS Well-Architected Framework** (six pillars).

## 0. Where things stand (gap analysis)

The app already produced and stored 121 objects (brand kit, marketing, 50 feed + 50 stories, the
print kit). Those are **derived** from Matt's headshot and the platform — they do **not** contain the
source brand assets. The `grant-assets` folder holds **40+ originals not yet in S3**:

| Source file(s) in `grant-assets/` | In S3 today? | Destination | Visibility |
|---|---|---|---|
| 16 × `…_Flyer_*.png` (1536×1024) | ❌ | `public/marketing/flyers/` | public |
| `…_Intro_Animation_Missouri.mp4`, `…_Logo_Animation.mp4`, `Matt Grant - Fixing Missouris Broken System.mp4` | ❌ | `public/video/` (+ poster) | public |
| `…_2026_Mandate/Presentation_Slides/*.jpg` (12) | ❌ | `public/marketing/deck/mandate/` | public |
| `The_Grant_Campaign_Engine without logo.pdf` (6.3 MB) | ◐ (a deck PDF exists) | `private/raw/deck/` | private (raw) |
| `…_Blue/Red/White.png` (1254²), `…_Logo_Lockup_Variations.png` | ◐ (processed logos exist) | `public/brand/` + `private/raw/logo/` | both |
| `Matt_Grant_for_Congress.jpg/.png` (256²) | ❌ | `public/brand/icons/` | public |
| `Matt_Grant_for_Congress_Infographic.png` (2752×1536), `A_New_Standard_of_Service.png` (2752×1536) | ◐ (smaller derivative live) | `private/raw/` (master) | private (raw) |
| `…_Dashboard_*.png` (2), `…_St_Louis_Arch.png` | ❌ | `public/web/` | public |
| `Missouri School Statistics 24-25.pdf` | ❌ | `private/data/` | private |
| `Missouri_Public_Schools_*/*.{shp,dbf,shx,prj,cpg,xml}` (2 sets) | ❌ | `private/data/geo/` | private |
| `.DS_Store` (×3) | — | **skip** (never upload) | — |

Legend: ✅ present · ◐ a derivative/related file is present, original is not · ❌ absent.

## 1. Target taxonomy (extends the content-operations plan)

```text
matt-grant-for-congress/
├── public/                     # served only through CloudFront (OAC); bucket stays private
│   ├── brand/                  # logo (color/navy/red/white), lockup, icons/ (favicon sources)
│   ├── marketing/              # infographic, banner, the deck, flyers/, deck/mandate/
│   ├── social/                 # feed/ · stories/ · captions/   (already live)
│   ├── print/                  # yard sign, palm card, mailer (PDF + proof)   (already live)
│   ├── video/                  # web-optimized mp4 + poster frames
│   └── web/                    # hero/OG images, dashboard mockups, photography
└── private/                    # never public — signed URLs / staff only
    ├── raw/                    # full-res masters (2752² art, 1254² logo, 6.3 MB deck)
    ├── data/                   # research PDFs + geo/ shapefiles (schools, precincts)
    └── exports/                # working files, drafts
```

Naming stays `mg-<category>-<topic>-<descriptor>-<WxH>.<ext>` for new exports; the imported
originals keep their names under `private/raw/` and get clean names only when promoted to `public/`.

## 2. The six pillars, applied to the asset store

**1 — Operational Excellence.** Everything is reproducible and indexed *as code*:
- `web/scripts/sync-assets.mjs` — idempotent, content-type-aware uploader with a `--dry-run` mode and
  a `MAP` table (source → key → visibility). Re-runnable; skips `.DS_Store`.
- `web/lib/assets.manifest.json` — generated index of every object (key, bytes, kind, visibility,
  checksum). The app + MCP read this; it's the recoverable catalog if the bucket is ever lost.
- The runbook (`docs/RUNBOOK.md`) documents add/promote/retire flows.

**2 — Security.** Already strong; keep and extend:
- Bucket is private with **Block Public Access = on** and **AES256** default encryption (verified).
  Public delivery is *only* via CloudFront **OAC** — no object ACLs, no public bucket policy.
- `private/**` is never fronted by the CDN; access is short-lived **pre-signed URLs** from an
  authenticated dashboard route. Voter/【school】data and raw masters live here.
- Least-privilege IAM: a `campaign-asset-rw` policy scoped to this one bucket; no `s3:*` and no
  long-lived keys in the repo — credentials come from SSM/role.
- No PII in `public/`. Donor/voter exports stay in `private/` (or out of S3 entirely).

**3 — Reliability.** Versioning is **Enabled** (verified) → every overwrite is recoverable.
- Add a **lifecycle rule** to keep noncurrent versions 90 days, then expire (bounded, recoverable).
- The repo manifest + the generator scripts mean derived assets can be **rebuilt from source**, so the
  durable thing to protect is `private/raw/` + `private/data/`. Optional: enable a same-region
  replication or periodic `aws s3 sync` backup of `private/` to a second bucket.

**4 — Performance Efficiency.** Separate **masters** from **delivery copies**:
- Serve web-optimized derivatives from `public/` (e.g. 1536-wide WebP/AVIF for flyers, poster JPEGs
  for video) and keep the 2752²/6.3 MB masters in `private/raw/` so the CDN never ships them.
- CloudFront caching with long `Cache-Control` (`max-age=604800, immutable`) on versioned asset keys.
- Host the three videos on the CDN for short clips; long-form can live on YouTube and be *linked*.

**5 — Cost Optimization.** The bucket is small, but make it self-managing:
- **Lifecycle**: transition `private/raw/**` and `private/data/**` to **Intelligent-Tiering** at 0
  days; expire incomplete multipart uploads after 7 days; expire noncurrent versions after 90.
- **Cost-allocation tags** on the bucket: `project=matt-grant`, `env=prod`, `owner=campaign`.
- Don't duplicate masters into `public/`; store once, derive on demand.

**6 — Sustainability.** Fewer, right-sized bytes moved:
- Modern formats (WebP/AVIF) + compression for public delivery; Intelligent-Tiering parks cold
  masters on lower-energy storage; CDN cache hits avoid repeated origin fetches.

## 3. Execution steps (each is one command/script run)

1. **Dry-run** `sync-assets.mjs --dry-run` → prints the full source→key map for sign-off.
2. **Upload** originals: `public/**` (flyers, deck slides, icons, dashboards, arch, web videos) and
   `private/**` (raw masters, school stats PDF, school shapefiles). `.DS_Store` skipped.
3. **Promote** the clean brand variants (blue/red/**white**/lockup) into `public/brand/`; wire the
   new **white logo** + favicon icons into the site.
4. **Apply governance**: put the **lifecycle policy** + **bucket tags** on the bucket (one
   `put-bucket-lifecycle-configuration` + one `put-bucket-tagging`).
5. **Generate** `assets.manifest.json` and surface the new public assets (flyers/video) on the Media
   page.
6. **Verify**: CDN 200s for new public keys; `private/**` returns 403 over the CDN and 200 only via a
   signed URL; `--dry-run` re-run shows zero diffs (idempotent).

## 4. Decisions to confirm before upload

- **Videos** — serve from the CDN (`public/video/`) or host on YouTube and link? (3 files, ~7 MB.)
- **School data + shapefiles** — `private/data/` (recommended; staff-only) or public for the map?
- **The "without logo" deck PDF** (6.3 MB) — `private/raw/` master only, or also a public download?

_Paid for by the Matt Grant for Congress Committee._
