# Secrets migration — out of the build artifact, into runtime SSM

Closes the HIGH finding: `amplify.yml` writes decrypted SSM SecureStrings into
`.env.production` at build time, and with `.next` + build cache as artifacts those
plaintext secrets can land in the artifact store / cache.

The code foundation is shipped: **`web/lib/ssm.ts` → `getSecret(name)`**, an
**env-first** runtime loader. While secrets are still baked, `getSecret` returns
the `process.env` value and never calls SSM — so each step below is independently
deployable and reversible, with **no gap** where a secret is unavailable.

## Order of operations (do not reorder — step 4 is last)

1. **Grant the runtime role SSM read.** Give the Amplify **SSR compute** role (not
   the build role) `ssm:GetParameter` on the exact `arn:aws:ssm:…:parameter/matt-grant/*`
   ARNs + `kms:Decrypt` on the one key. Leave the build role's SSM/KMS in place for now.
2. **Wire call sites to `getSecret`.** Replace `process.env.X` reads of secrets
   with `await getSecret("X")` in their (already async) request handlers. Targets:
   `CRON_SECRET`, `WINRED_WEBHOOK_SECRET`, `CLERK_WEBHOOK_SIGNING_SECRET`,
   `UNSUB_SECRET`, `ANTHROPIC_API_KEY`, and the external API keys. Because env still
   wins, this deploys with zero behavior change. (Module-level `const KEY =
   process.env.X` reads must move inside the async handler first.)
3. **Stop baking the secrets.** Remove the secret names from the `.env.production`
   materialization loop in `amplify.yml` (keep non-secret config like
   `DYNAMODB_TABLE`, `AWS_REGION`, `NEXT_PUBLIC_*`). Deploy. Now those secrets are
   absent from env, so `getSecret` reads them from SSM at runtime — out of the
   artifact. Verify the app still authenticates webhooks/cron and calls the LLM.
4. **Rotate.** Any secret that ever lived in a baked/cached build is considered
   exposed — regenerate it in its console (Clerk, Anthropic, WinRed, and the
   app-generated `CRON_SECRET`/`UNSUB_SECRET`) and update the SSM parameter. Then
   remove SSM/KMS from the **build** role.

## Why env-first matters

Each step is a no-op until the next: wiring (step 2) changes nothing while baking
is on; un-baking (step 3) only takes effect because the loader is already wired.
If anything misbehaves, re-add the secret to `amplify.yml` and redeploy — env wins
again instantly.

## Validation per step

- After step 2: webhooks (WinRed/SES/Clerk) and `/api/cron/email-drain` still
  return their normal responses; press-topics LLM call still works.
- After step 3: same checks, plus confirm the secrets are **absent** from the
  deployed env (e.g. a temporary debug route or Amplify env inspection) and that
  CloudWatch shows the SSM `GetParameter` calls.
