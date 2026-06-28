# RBAC-driven messaging — reference & compliance audit

How the campaign sends email/SMS to the right people, who controls it, and the consent guarantees
that hold on every path. This is the single reference for the four-phase RBAC-messaging initiative
(PRs #182, #186, #188, #190) and the audit checklist for it.

Educational/operational doc — not legal advice. Confirm CAN-SPAM/TCPA specifics with counsel.

## Two independent layers

1. **Authorization (who may send)** — Clerk RBAC. Only admins hold `sendEmailCampaign` / `sendSms`;
   captains may `draftEmailCampaign` / `draftSms`. Automated triggers run server-side (no human send).
2. **Audience (who receives)** — independent of the sender's role. Resolved from:
   - **Data-record audiences**: volunteers/donors (DynamoDB), captains/all-team (staff store),
     subscribers (SMS consent ledger), supporter segments (CRM interest).
   - **Clerk-role audiences** (Phase 1): every account whose `publicMetadata.role` = X, via
     `lib/clerkAudiences.ts`. Distinct from data-record audiences.

## Consent guarantees (enforced on every path)

| Channel | Guarantee | Where enforced |
|---|---|---|
| Email | Topic opt-outs + global suppression (unsubscribed/bounced/complained) applied at send | `lib/subscribers.ts`, campaign drain; team-only sends are `internal` and bypass topic opt-outs (still honor unsubscribe) |
| Email | One-click unsubscribe + List-Unsubscribe header | `lib/email/*`, SES bounce/complaint webhook auto-suppresses |
| SMS | Recipients are **opted-in by construction** — every candidate number is intersected with the consent ledger; drain re-checks at send | `lib/sms/audiences.ts` (`resolveSmsRecipients`), `lib/sms/campaigns.ts` |
| SMS | STOP/opt-out honored; blocked numbers excluded; quiet hours 9am–8pm CT | `lib/sms/consent.ts`, `lib/sms/moderation.ts`, sms drain |

**Role targeting does NOT bypass consent.** An external role (donor/supporter/partner) targeted by
email honors topic opt-outs; any role targeted by SMS only reaches opted-in numbers. Staff-only
sends (staff roles + team groups) are `internal` (operational) — they bypass topic opt-outs only.

## Automated triggers (Phase 2) + preferences (Phase 3a)

`lib/notifications/staffNotify.ts` — best-effort, self-guarded on `sesEnabled`, never fails the
underlying write. Recipients = staff store + env allowlist (admins), **minus per-staffer opt-outs**.

| Trigger | Notifies role | Opt-out type key |
|---|---|---|
| Pending issue submission | admin + captain | `issue_moderation` |
| New volunteer (wants to help) | captain | `new_volunteer` |
| New WinRed donation | admin | `new_donation` |
| Role assigned/changed | the affected user | (not opt-outable) |

Each staffer manages their own opt-outs at `/dashboard/notifications` (`lib/notifications/prefs.ts`,
own DynamoDB partition so env-allowlist admins can mute too). `emailsMuting()` is fail-open — a prefs
read error never silences a needed alert.

## Templates (Phase 3b)

`/dashboard/templates` — admins save role-tagged email/SMS copy. Saved templates ride the existing
generic send paths (email → `announcement` broadcast, SMS → `custom` template), so there is no new
sender and the consent/compliance layers above apply unchanged. Composers prefill copy + pre-select
the tagged role.

## Audit checklist

- [ ] Only admins can `sendEmailCampaign` / `sendSms` (rbac.test.ts) — captains draft only.
- [ ] `resolveSmsRecipients` returns only opted-in, non-blocked numbers for **every** source
      (subscribers, volunteers, roles, and combinations) — `lib/sms/audiences*.test.ts`,
      `lib/messaging-invariants.test.ts`.
- [ ] Email `internal` (bypass topic opt-outs) is true ONLY when every source is staff/team and no
      external segment/role — `lib/email/audiences*.test.ts`, invariants test.
- [ ] Triggers drop staffers who opted out (`staffNotify.test.ts`) and never throw.
- [ ] No Airtable/Clerk-role audience reaches the public unintentionally; role targeting is staff-gated
      to send (admin) and consent-gated to receive.
- [ ] Twilio configured (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_MESSAGING_SERVICE_SID`);
      SES configured (`SES_FROM`). Both no-op cleanly when unset.

## Test map

- `lib/email/audiences.test.ts` / `audiences-roles.test.ts` — email audience resolution + role targeting.
- `lib/sms/audiences.test.ts` / `audiences-roles.test.ts` — SMS opt-in gating + role targeting.
- `lib/notifications/staffNotify.test.ts` — trigger recipients + per-staffer mute + best-effort.
- `lib/notifications/messageTemplates.test.ts` — template store.
- `lib/messaging-invariants.test.ts` — cross-cutting: combined roles+groups never leak a
  non-consented recipient.
