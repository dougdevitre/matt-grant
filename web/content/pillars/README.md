# Synced pillar content

This directory holds resource content imported from the `dougdevitre/access-to-*`
repos by `scripts/sync-pillars.mjs`. **It is generated output that is committed to
the repo** so the Amplify build needs no network/git access.

```
content/pillars/<pillar>/
  manifest.json     # { pillar, repo, syncedAt, docs[], tools[] } — drives the routes
  <doc-slug>.md     # one markdown article per synced doc
```

Standalone HTML tools land in `public/pillar-tools/<pillar>/` (served as static
assets, embedded by the tools route).

To refresh:

```bash
npm run sync:pillars            # all pillars
npm run sync:pillars -- --only education
npm run sync:pillars -- --dry-run
```

Then review and commit `content/pillars/**` and `public/pillar-tools/**`.
Pages render a "being prepared" fallback for any pillar that hasn't been synced yet,
so the site always builds.

> **Requires GitHub egress.** The sync does `git clone --depth 1` from each
> `github.com/dougdevitre/access-to-*` repo, so run it from an environment that can
> reach github.com (your machine or CI). It will NOT run inside a sandbox whose
> network is scoped to a single repo — `git clone` returns HTTP 403 there. CI option:
> a GitHub Action that runs `npm run sync:pillars` and commits the result on a
> schedule keeps every hub current without manual steps.
