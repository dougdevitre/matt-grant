# e2e/ — accessibility harness

Playwright + `@axe-core/playwright` scan of the **public** site for WCAG 2.0/2.1
A & AA violations. This is the automated complement to the manual a11y pass in
`docs/compliance-audit.md` (item A-9).

## Run locally

```bash
cd web
npx playwright install chromium   # one-time: fetch the browser
npm run test:a11y                 # builds, starts on :3100, scans the routes
```

The harness boots a production build (`next build && next start`) so it tests
what ships. It fails only on **serious/critical** axe impacts to stay actionable;
moderate/minor issues appear in the report without blocking.

## CI

`.github/workflows/a11y.yml` runs this on PRs and on demand (`workflow_dispatch`).
It's a **separate** workflow from the required `ci` gate so a11y findings are
visible without blocking unrelated merges until the route list is tuned. Promote
it to a required check once the public pages are clean.

## Conventions

- Unit tests are `*.test.ts` (vitest). E2E/a11y specs are `*.spec.ts` here (Playwright).
  The two runners never overlap — vitest only globs `**/*.test.ts`.
- Add a route to `ROUTES` in `a11y.spec.ts` when you ship a new public page.
- Staff dashboard pages are auth-gated and intentionally out of scope.
