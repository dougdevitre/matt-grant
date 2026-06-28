# Print-at-Walgreens Plan — Native Photo Prints API

Goal: let any supporter pick a Matt Grant graphic, choose a size, and pick it up **printed at their
local Walgreens the same day** — turning the digital Media library into physical yard-window signs,
flyers, and palm cards with no design work on their end.

> Compliance note (educational, not legal advice): printed campaign materials are "public
> communications" and must carry the **"Paid for by Matt Grant for Congress."**
> disclaimer — our assets already do. Because the **supporter pays Walgreens directly** at pickup,
> the print is their own volunteer activity, not a campaign expenditure; if the *committee* ever pays
> for prints, that's an expenditure/in-kind question for the treasurer/counsel. Confirm before
> enabling committee-funded printing.

## 0. The big simplification — Custom Uploads + our CDN

Walgreens supports two ways to supply images: (a) upload bytes to their Azure blob via a SAS token,
or (b) **Custom Uploads** — pass *your own URL* as long as it's reachable for ≥36 hours via a simple
GET. We already serve permanent, public assets through CloudFront
(`d5jzyan9wboi3.cloudfront.net/public/...`). So we **skip the creds/upload/blob flow entirely** and
just hand Walgreens our CDN URLs at order time. Less code, no image bytes through our servers.

## 1. Architecture (fits the existing Next.js + AWS stack)

```text
Browser (supporter)
  └─ /print  UI: pick asset → size → qty → name/phone/email → geolocate → store → T&C → submit
        │  (no Walgreens key ever touches the client)
        ▼
Next.js API routes  (BFF — holds the apiKey/affId server-side)
  ├─ POST /api/print/products   → Walgreens products/v3   (sizes + prices; call every render)
  ├─ POST /api/print/stores     → Walgreens store/v3      (lat/long → nearby stores + promiseTime)
  ├─ POST /api/print/coupon     → Walgreens coupon/v3     (optional)
  ├─ POST /api/print/order      → Walgreens order/submit/v3
  └─ POST /api/print/status     → Walgreens order/status/v3
        │
        ├─ image URLs = CloudFront links to print-sized renditions in S3
        └─ orders persisted in DynamoDB (single table) for status polling/reorder
```

Secrets in SSM `/matt-grant/*` (same pipeline as the rest): `WALGREENS_API_KEY`,
`WALGREENS_AFF_ID`, `WALGREENS_PUBLISHER_ID` (optional revenue-share id). Never `NEXT_PUBLIC_`.

## 2. "Different product sizes" — the rendition system  ✅ shipped (4×6 · 5×7 · 8×10)

`web/scripts/generate-print-renditions.mjs` renders 12 signature designs to each
photo-print aspect at 300 DPI (clearance-aware layout so the portrait + disclaimer never crop),
uploads to `public/print/walgreens/<id>/<size>.jpg`, and writes `lib/printRenditions.json` — which
the print studio reads to send the **exact-aspect** image for the chosen size. Add more sizes
(posters) or designs by extending the SIZES / DESIGNS tables and re-running.

Walgreens photo prints are fixed aspect ratios (4×6, 5×7, 8×10, plus posters like 11×14 / 16×20).
Our source art is a mix of square (1080²) and landscape (1536×1024), so we **re-lay-out each asset per
product** rather than stretch it. Extend the existing generators (`generate-social-graphics.mjs` /
`generate-print-kit.mjs`) with a size table:

| Product | Pixels @300 DPI | Orientation | Source treatment |
|---|---|---|---|
| 4×6 | 1200×1800 | portrait | story/flyer layout, full-bleed |
| 5×7 | 1500×2100 | portrait | flyer layout |
| 8×10 | 2400×3000 | portrait | poster layout (name + photo + line) |
| 6×4 | 1800×1200 | landscape | the 1536×1024 flyers, re-bled |
| 11×14 / 16×20 | 3300×4200 / 4800×6000 | portrait | large poster layout |

Renditions are written to `public/print/walgreens/<asset>-<size>.jpg` (JPEG — Walgreens prefers we
convert) and meet each product's `dpi`/`resWidth`/`resHeight` from `products/v3`. The `offsetWidth/
offsetHeight` values tell us the safe area so the "Paid for by" line and Matt's face never get
trimmed.

## 3. Order flow (mapped to the endpoints)

1. **Products** — `POST /api/print/products` → cache `productId`, `productSize`, `productPrice`,
   `dpi`, offsets. Show real-time prices (their docs require fetching every time prices are shown).
2. **Select** — supporter picks asset(s) + size(s) + qty (standard prints cap **20 per image url**;
   order cap **200 distinct images** and **< $998** post-coupon).
3. **Store** — browser geolocation → `POST /api/print/stores` with the cart → list stores with
   `promiseTime`. Render `01-01-3000 00:00 AM` as **"Within 48 hours."**
4. **Coupon** (optional) — `POST /api/print/coupon`; only attach `couponCode` to the order if it
   validates. Subtract `orderDiscountPrice` from the total in the UI.
5. **Details + consent** — collect first/last/phone/email and a **required** checkbox: *"I have read
   and agree to the Terms of Use and Online Privacy & Security Policy."* (Walgreens mandates this.)
6. **Submit** — `POST /api/print/order` with `productDetails:[{productId, imageDetails:[{url,qty}]}]`,
   `storeNum`, `promiseTime`, `affNotes` = our order tracking id. Store the `vendorOrderId`.
7. **Track** — `POST /api/print/status` → Submitting → Downloading → Ready for Pickup → Sold. Surface
   "Ready for pickup at your Walgreens."

## 4. Guardrails & gotchas (from their spec)

- **36-hour URL rule** — CloudFront public assets are permanent, so renditions qualify; never put a
  rendition behind the `private/` (signed-only) prefix.
- **Limits** — ≤20 qty/url, ≤200 images, < $998; respect 300 req/min (100 for coupon).
- **PII** — name/phone/email go to Walgreens for fulfillment only; store the minimum in DynamoDB,
  keep it out of any `public/` object, and cover it in the site privacy policy.
- **Sandbox first** — build against `services-qa.walgreens.com`; **production launch requires
  Walgreens approval** of the app.
- **Revenue share** — `publisherId` can earn a share; for a campaign we likely **omit/​waive** it to
  avoid an income/reporting wrinkle — confirm with the treasurer.

## 5. Phases

- **Phase 0 — Access.** Create the Walgreens developer app, accept the API License + Photo Finishing
  agreements, get **sandbox** `apiKey`/`affId`, store in SSM. (No code.)
- **Phase 1 — MVP.** BFF routes + Custom-Upload CDN URLs; render 4×6 + 8×10 for ~6 hero assets;
  single-product order; geolocation store picker; T&C; status. End-to-end in sandbox.
- **Phase 2 — Catalog.** Multi-product cart, coupon support, the full size table across all flyers +
  the 50 social graphics, reorder, order history in DynamoDB.
- **Phase 3 — Production.** Walgreens approval, prod creds, analytics, and a "Print at Walgreens"
  button on every Media card.

## 6. First concrete step

Stand up the **sandbox**: register the app, drop `WALGREENS_API_KEY` + `WALGREENS_AFF_ID` into SSM,
and ship a read-only `POST /api/print/products` route so we can confirm the product catalog + sizes
before building the renderer. Everything else builds on that.

_Paid for by Matt Grant for Congress._
