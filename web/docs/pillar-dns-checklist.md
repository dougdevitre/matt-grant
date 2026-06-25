# Pillar subdomains — DNS / Amplify rollout checklist

Copy-pasteable ops steps to make the 12 pillar subdomains live. Requires AWS console
(or CLI) access to the Amplify app + the Route 53 hosted zone for
`mattgrantforcongress.org`. Do this AFTER the apex itself is on Amplify
(see `docs/GO-LIVE.md`) — the subdomains attach to the same app.

Subdomains to serve (all point at the SAME Amplify app):

- Resource hubs: `education` `jobs` `housing` `food` `health` `justice` `business` `services`
- Vanity issue redirects: `courts` `limits` `lean` `taxes`

A single wildcard `*.mattgrantforcongress.org` covers all 12 at once — strongly preferred.

---

## Option A — Wildcard (recommended)

- [ ] Amplify console → your app → **Hosting → Custom domains** (the apex
      `mattgrantforcongress.org` should already be added here).
- [ ] **Add domain** / manage the existing `mattgrantforcongress.org` → add a
      **subdomain** entry `*` (wildcard) mapped to the **main** branch. Amplify
      requests an ACM certificate covering `*.mattgrantforcongress.org`.
- [ ] Amplify shows CNAME records to create for **certificate validation**. If the
      hosted zone is in the same account, click **Update DNS records** to have
      Amplify write them to Route 53 automatically; otherwise add them by hand
      (see Route 53 step).
- [ ] Wait for status **Available** (cert issue + propagation, ~minutes to ~30 min).

## Option B — Explicit per-subdomain (if wildcard isn't usable)

- [ ] In the same **Custom domains** panel, add each subdomain as its own mapping
      to the **main** branch:
      `education` `jobs` `housing` `food` `health` `justice` `business` `services`
      `courts` `limits` `lean` `taxes`.
- [ ] Approve the ACM cert validation records for each (same Update-DNS-records flow).

---

## Route 53 records (only if Amplify did NOT auto-write them)

For each Amplify-provided target (`<branch>.<app-id>.amplifyapp.com`):

- [ ] Wildcard: add a record `*.mattgrantforcongress.org` → **CNAME** →
      the Amplify domain target Amplify shows. (Or an **A/ALIAS** if Amplify gives an
      alias target.)
- [ ] Explicit: one CNAME per label, e.g.
      `education.mattgrantforcongress.org` → `<target>`, …
- [ ] Add any **certificate-validation CNAMEs** Amplify lists (one per cert SAN).

CLI sketch (fill in `HOSTED_ZONE_ID` and the Amplify `TARGET`):

```bash
aws route53 change-resource-record-sets --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{
    "Name":"*.mattgrantforcongress.org","Type":"CNAME","TTL":300,
    "ResourceRecords":[{"Value":"TARGET.amplifyapp.com"}]}}]}'
```

---

## Verify (after status = Available)

- [ ] TLS + hub renders:
      `curl -I https://education.mattgrantforcongress.org` → `200`, valid cert.
- [ ] Shared chrome: load `https://education.mattgrantforcongress.org` in a browser —
      Matt header/footer/AskMatt present; nav links go to the apex.
- [ ] Vanity redirect:
      `curl -I https://courts.mattgrantforcongress.org` → `308` with
      `location: https://mattgrantforcongress.org/issues/family-courts`.
      Repeat for `limits.`/`lean.`/`taxes.`.
- [ ] `justice.` serves the legal-aid hub (200), NOT a redirect.
- [ ] Apex unaffected: `https://mattgrantforcongress.org` still the campaign home.

## Notes

- The app code already routes by `Host` header (see `web/middleware.ts` +
  `web/docs/pillar-subdomains.md`); DNS is the only remaining step.
- Resource hubs show a "being prepared" placeholder until content is synced —
  run the `sync-pillars` workflow (or `npm run sync:pillars`) to populate them.
- Compliance: have campaign counsel sign off on the committee-hosted resource
  subdomains before promoting them publicly.
