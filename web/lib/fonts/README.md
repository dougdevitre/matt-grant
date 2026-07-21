# Vendored brand fonts (for server-side image rendering)

The `.woff2` binaries live in **`web/public/fonts/`** (so Next's standalone output
always ships them — `public/` is copied wholesale); this directory holds the loader
(`brandFonts.ts`) + docs. These are the exact typefaces `next/og` (`ImageResponse`/
satori) needs as raw font buffers to render our social/OG images — see
`web/lib/fonts/brandFonts.ts`, `web/lib/og.tsx`, and `web/app/api/graphics/route.tsx`.

We **self-host** them (rather than fetching Google Fonts at request time) so a
Google Fonts outage can never silently downgrade the brand typeface — or the FEC
"Paid for by" disclaimer baked onto every generated image — to a fallback font.

| File | Face | Weight | Source |
|---|---|---|---|
| `fraunces-700.woff` | Fraunces | 700 (headline) | `@fontsource/fraunces` v5, `files/fraunces-latin-700-normal.woff` |
| `public-sans-600.woff` | Public Sans | 600 (labels) | `@fontsource/public-sans` v5, `files/public-sans-latin-600-normal.woff` |

**WOFF v1, not woff2** — satori/opentype (what `next/og` uses) can't decode the woff2
signature (`Unsupported OpenType signature wOF2`); it accepts TTF/OTF/WOFF(v1).

Latin subset — the images only ever render English eyebrow/headline/subhead/
disclaimer (incl. `—` and `·`), all covered by Latin.

## Regenerate

```
npm pack @fontsource/fraunces@5 @fontsource/public-sans@5
tar -xzf fontsource-fraunces-*.tgz && tar -xzf fontsource-public-sans-*.tgz
cp package/files/fraunces-latin-700-normal.woff   web/public/fonts/fraunces-700.woff
cp package/files/public-sans-latin-600-normal.woff web/public/fonts/public-sans-600.woff
```

(`next/font/google` in `app/layout.tsx` self-hosts fonts for the HTML site chrome; that
pipeline produces hashed assets satori can't consume, which is why these live here.)
