# Inbound event email (Phase 2)

Forward an event email to **events@mattgrantforcongress.org** and it becomes a
**DRAFT** event in `/dashboard/events` for staff to review. Mail is received and
parsed entirely inside the AWS account — no third-party processor.

## Flow

```
events@<domain>  ──MX──▶  SES email receiving  ──receipt rule──▶  SNS topic
                                                                     │
                                              POST (signature-verified)
                                                                     ▼
                                            /api/webhooks/inbound-email
                                   (parse with the LLM → createEvent status=DRAFT)
```

- The webhook (`web/app/api/webhooks/inbound-email/route.ts`) verifies the SNS
  signature (`web/lib/sns.ts`), optionally pins `INBOUND_SNS_TOPIC_ARN`, and
  auto-confirms the SNS subscription on first contact.
- `web/lib/events/mime.ts` turns the SES "Received" notification into
  from/subject/text (commonHeaders + base64 raw MIME → plaintext).
- Events are always created as **DRAFT** — never auto-published, never auto-notify.
  Retries are idempotent (sha256 dedupe key).

## One-time setup

1. **Run the provisioner** (creates the SNS topic + policy, subscribes the webhook,
   creates and activates the SES receipt rule, writes config to SSM):

   ```bash
   INBOUND_EMAIL_DOMAIN=mattgrantforcongress.org \
   BASE_URL=https://mattgrantforcongress.org \
   CRON_SECRET=… \
   bash infra/setup-aws.sh
   ```

   > SES email receiving exists only in **us-east-1 / us-west-2 / eu-west-1**.

2. **Verify the domain for *receiving*** in SES (region must match the rule set).

3. **Add the MX record** at your DNS host:

   ```
   mattgrantforcongress.org.   MX   10   inbound-smtp.us-east-1.amazonaws.com.
   ```

4. **Pin the topic**: add `INBOUND_SNS_TOPIC_ARN` (printed by the script, also in
   SSM `/matt-grant/INBOUND_SNS_TOPIC_ARN`) to the Amplify environment and redeploy.

## Verify end-to-end

- **Setup page**: `/dashboard/setup` → "Inbound event email" shows **Live** once
  `INBOUND_SNS_TOPIC_ARN` is in the deployed env.
- **Real mail**: forward any event email to `events@<domain>` → within a minute a
  DRAFT appears in `/dashboard/events`.
- **Subscription health**: in the SNS console the HTTPS subscription to
  `…/api/webhooks/inbound-email` should be **Confirmed** (the route confirms it
  automatically on the first delivery).
