# Donor & Supporter Data Handling (internal runbook)

Closes audit finding **D-1**. This is the *internal operational* companion to the public-facing [Data Policy](./policies/data-policy.md): who may see supporter and donor data, how long it's kept, and how it's deleted. It documents existing behavior in the code — it is not legal advice; confirm retention specifics with the committee's treasurer/counsel.

*Last updated: 2026-06-18.*

## What data we hold and where

| Data | Source | Store |
|---|---|---|
| Supporter/volunteer intake (name, email, phone, city, interests, message) | public `/contact` form | DynamoDB single-table (`PK = volunteers`), `lib/db.ts` |
| Donor records (name, city, amount, employer, occupation, method) | staff entry in `/dashboard/donors` | DynamoDB single-table |
| Expenditures (payee, amount, category, memo) | `/dashboard/finance` | DynamoDB single-table |
| Auth identity (email, role) | Clerk | Clerk |

Payment data is **not** stored by us — contributions are processed by WinRed.

## Who can see it (access control)

Two layers gate the dashboard (see `middleware.ts`, `lib/auth.ts`, `lib/rbac.ts`):

1. **Authentication** — Clerk sign-in required for all `/dashboard` and staff APIs. With no Clerk keys configured, production **fails closed** (redirects to `/?staff=locked`); local dev runs open as a demo.
2. **Email allowlist** — even signed-in users must be on `DASHBOARD_ALLOWLIST`. Two bootstrap admins are always allowed and un-removable: `dougdevitre@gmail.com`, `mattgrantforcongress@gmail.com`.
3. **Role capabilities** — `can(role, capability)` from `lib/rbac.ts` (role on Clerk `publicMetadata.role`):

| Role | Donor PII (`viewDonorDetail`) | Finance/donor **totals** (`viewFinanceTotals`) | Edit finance | Compliance | Send email |
|---|---|---|---|---|---|
| **Admin** | ✅ full list + logging | ✅ | ✅ | ✅ | ✅ |
| **Captain** | ❌ totals only | ✅ | ❌ | ❌ | draft only |
| **Organizer** | ❌ | ❌ | ❌ | ❌ | ❌ |

So **donor names and contact details are visible to admins only**; captains see aggregate totals; organizers see neither. Any new capability must be added explicitly to the `MATRIX` (admin is not a wildcard) — a deliberate-decision safeguard.

## Retention

- Keep contribution and supporter records as long as needed for the campaign **and** to meet federal recordkeeping duties. The FEC requires committees to retain records supporting filed reports for **3 years** after the report is filed (11 CFR 102.9 / 104.14). Verify the current rule before purging.
- After the retention window, dispose of records securely (delete from DynamoDB; remove any exports).
- Do **not** store SSNs, bank/card numbers, or passwords (per project guardrails).

## Deletion / data requests

- Public requests arrive via the Data Policy channel: email to `mattgrantforcongress@gmail.com`, subject "Data Request."
- An **admin** services the request: locate the record(s) in `/dashboard/donors` or the volunteers data, honor access/correction/deletion **subject to records the committee must retain by law** (a contribution already reported to the FEC is public record and cannot be unpublished).
- Log what was changed/deleted and when.

## Security & incident basics

- Access limited to allowlisted staff; least-privilege roles as above.
- DynamoDB/S3/SES reached via the Amplify SSR compute role — no shared long-lived keys in the app.
- If supporter/donor data is exposed or accessed improperly, notify the treasurer/admins immediately, rotate any affected credentials, and assess notification obligations.

## Open / to confirm

- Confirm the exact FEC retention period and start date with the treasurer.
- Donor-detail export (CSV) currently exists for targets; if a donor CSV export is added, it inherits these same access rules and must not be stored unsecured.
