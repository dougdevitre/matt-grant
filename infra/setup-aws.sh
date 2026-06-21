#!/usr/bin/env bash
# setup-aws.sh — codify the operational AWS fixes the assessment flagged.
#
# Idempotent AWS CLI script that provisions the pieces Amplify Hosting does NOT
# give you out of the box and that are required before this app carries live
# donor data + fundraising email:
#   1. DynamoDB Point-In-Time Recovery (PITR)         — Reliability (no backups)
#   2. CloudWatch log-group retention                  — Cost (logs never expire)
#   3. The two scheduled jobs (ingest + email-drain)   — Reliability (cron is dead on Amplify)
#   4. A Lambda-errors CloudWatch alarm → SNS email    — Operational Excellence (no alerting)
#
# REVIEW BEFORE RUNNING. This was authored without access to the live account,
# so confirm the resource names/ARNs below match your environment. Every step is
# guarded to be re-runnable. Requires AWS CLI v2 + credentials with rights to
# DynamoDB, CloudWatch Logs, EventBridge (events + scheduler), SNS, and IAM.
#
# Usage:
#   CRON_SECRET=... BASE_URL=https://mattgrantforcongress.org \
#   ALERT_EMAIL=you@example.com bash infra/setup-aws.sh

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
TABLE="${DYNAMODB_TABLE:-matt-grant}"
BASE_URL="${BASE_URL:?set BASE_URL to the deployed site origin, e.g. https://mattgrantforcongress.org}"
CRON_SECRET="${CRON_SECRET:?set CRON_SECRET (same value the routes verify)}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-90}"
AMPLIFY_APP_ID="${AMPLIFY_APP_ID:-d1roai8s7wowoi}"
ACCT="$(aws sts get-caller-identity --query Account --output text)"

say() { printf '\n=== %s ===\n' "$*"; }

# ── 1. DynamoDB PITR ────────────────────────────────────────────────────────────
# Continuous backups with 35-day point-in-time restore. Protects donor/FEC data
# from a bad write or accidental delete. One call, safe to repeat.
say "DynamoDB PITR on $TABLE"
aws dynamodb update-continuous-backups \
  --table-name "$TABLE" --region "$REGION" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  >/dev/null && echo "PITR enabled."

# ── 2. CloudWatch log retention ─────────────────────────────────────────────────
# Cap retention (default never-expire) on THIS app's log groups only — matched by
# the Amplify app id so we never touch unrelated projects in the account.
say "Log retention → ${LOG_RETENTION_DAYS}d (app ${AMPLIFY_APP_ID} only)"
for lg in $(aws logs describe-log-groups --region "$REGION" \
              --query "logGroups[?contains(logGroupName, '${AMPLIFY_APP_ID}')].logGroupName" \
              --output text); do
  aws logs put-retention-policy --log-group-name "$lg" \
    --retention-in-days "$LOG_RETENTION_DAYS" --region "$REGION" && echo "  $lg"
done

# ── 3. Scheduled jobs (EventBridge Rules → API destination) ──────────────────────
# Amplify has no native cron and ignores vercel.json, so the weekly research
# ingest and the ~1-min email-drain never fire. This wires both as real schedules.
# Auth: an EventBridge Connection holds the bearer secret as an Authorization
# header so it never appears in the schedule definition.
say "Scheduled jobs"
CONN_NAME="matt-grant-cron"
if ! aws events describe-connection --name "$CONN_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws events create-connection --name "$CONN_NAME" --region "$REGION" \
    --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=Authorization,ApiKeyValue=Bearer ${CRON_SECRET}}" \
    >/dev/null && echo "connection $CONN_NAME created"
else
  echo "connection $CONN_NAME exists"
fi
CONN_ARN="$(aws events describe-connection --name "$CONN_NAME" --region "$REGION" --query ConnectionArn --output text)"

create_destination() { # name path
  local name="$1" path="$2"
  if ! aws events describe-api-destination --name "$name" --region "$REGION" >/dev/null 2>&1; then
    aws events create-api-destination --name "$name" --region "$REGION" \
      --connection-arn "$CONN_ARN" --http-method POST \
      --invocation-endpoint "${BASE_URL}${path}" \
      --invocation-rate-limit-per-second 10 >/dev/null && echo "  api-destination $name" >&2
  fi
  # ONLY the ARN goes to stdout — this is captured via $(). Any log/progress
  # line above must go to stderr (>&2) or it pollutes the captured value.
  aws events describe-api-destination --name "$name" --region "$REGION" --query ApiDestinationArn --output text
}
DEST_INGEST="$(create_destination matt-grant-ingest /api/research/ingest)"
DEST_DRAIN="$(create_destination matt-grant-email-drain /api/cron/email-drain)"
DEST_NEWS="$(create_destination matt-grant-research-news /api/research/news)"
DEST_BIO="$(create_destination matt-grant-research-bio /api/research/bio)"

# Execution role EventBridge assumes to invoke the API destinations. Trust must be
# events.amazonaws.com for EventBridge Rules. (Idempotently corrected from any
# earlier scheduler.amazonaws.com trust.)
ROLE_NAME="matt-grant-scheduler-role"
TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"events.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST" >/dev/null && echo "role $ROLE_NAME created"
else
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST" >/dev/null && echo "role $ROLE_NAME trust → events.amazonaws.com"
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name invoke-api-destinations \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"events:InvokeApiDestination\",\"Resource\":\"arn:aws:events:${REGION}:${ACCT}:api-destination/matt-grant-*\"}]}" \
  >/dev/null && echo "invoke policy attached"
ROLE_ARN="arn:aws:iam::${ACCT}:role/${ROLE_NAME}"

# A scheduled EventBridge Rule per job, targeting the API destination. We use
# Rules (not the newer EventBridge Scheduler) so this works on AWS CLI v2.4+.
# IAM is eventually consistent — a freshly-created role can take a few seconds
# before put-targets accepts it; the retry below absorbs that.
create_rule() { # name expr destArn
  local name="$1" expr="$2" dest="$3" failed
  aws events put-rule --name "$name" --region "$REGION" \
    --schedule-expression "$expr" --state ENABLED >/dev/null && echo "  rule $name set ($expr)"
  local targets="[{\"Id\":\"1\",\"Arn\":\"${dest}\",\"RoleArn\":\"${ROLE_ARN}\",\"RetryPolicy\":{\"MaximumRetryAttempts\":2}}]"
  for attempt in 1 2 3; do
    failed=$(aws events put-targets --rule "$name" --region "$REGION" --targets "$targets" --query 'FailedEntryCount' --output text)
    [ "$failed" = "0" ] && { echo "    target wired"; return 0; }
    sleep 5
  done
  echo "    WARNING: target not wired after retries (FailedEntryCount=$failed) — re-run to retry"
}
create_rule matt-grant-research-ingest "cron(0 8 ? * MON *)" "$DEST_INGEST"
create_rule matt-grant-email-drain     "rate(1 minute)"      "$DEST_DRAIN"
# Lightweight enrichments refresh on their own cadence (decoupled from the heavy
# ingest): news daily (time-sensitive), bios weekly (rarely change).
create_rule matt-grant-research-news   "cron(0 9 * * ? *)"   "$DEST_NEWS"
create_rule matt-grant-research-bio    "cron(0 9 ? * MON *)" "$DEST_BIO"

# ── 4. Alerting ──────────────────────────────────────────────────────────────────
# Without this, donations/emails can stop silently. Alarm on SSR Lambda errors and
# notify an email via SNS. (Set ALERT_EMAIL to enable; confirm the subscription
# from your inbox afterward.)
if [ -n "$ALERT_EMAIL" ]; then
  say "Alerting → $ALERT_EMAIL"
  TOPIC_ARN="$(aws sns create-topic --name matt-grant-alerts --region "$REGION" --query TopicArn --output text)"
  aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email --notification-endpoint "$ALERT_EMAIL" \
    --region "$REGION" >/dev/null && echo "subscription requested (confirm via email)"
  # Aggregate Lambda errors across the account's functions. Tighten to the Amplify
  # SSR function name with --dimensions once you have it for a precise signal.
  aws cloudwatch put-metric-alarm --region "$REGION" \
    --alarm-name matt-grant-lambda-errors \
    --alarm-description "SSR/Lambda errors — donations or email may be failing" \
    --namespace AWS/Lambda --metric-name Errors --statistic Sum \
    --period 300 --evaluation-periods 1 --threshold 1 --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions "$TOPIC_ARN" >/dev/null && echo "alarm matt-grant-lambda-errors set"
else
  echo "(skipping alerting — set ALERT_EMAIL to enable)"
fi

# ── 5. Research-data staleness canary ────────────────────────────────────────────
# Route 53 health check on the public freshness endpoint, which returns 503 when
# candidate data has gone stale (no ingest in RESEARCH_STALE_DAYS). The check goes
# unhealthy → CloudWatch alarm → the same SNS topic. Tagged so re-runs reuse the
# existing check instead of creating duplicates. (Route 53 health-check metrics are
# global, published to us-east-1 — where this alarm must live.)
if [ -n "$ALERT_EMAIL" ]; then
  say "Research staleness canary"
  HC_HOST="$(printf '%s' "$BASE_URL" | sed -E 's#^https?://##; s#/.*$##')"
  HC_ID=""
  for id in $(aws route53 list-health-checks --query "HealthChecks[].Id" --output text 2>/dev/null); do
    nm=$(aws route53 list-tags-for-resource --resource-type healthcheck --resource-id "$id" \
          --query "ResourceTagSet.Tags[?Key=='Name']|[0].Value" --output text 2>/dev/null)
    if [ "$nm" = "matt-grant-research-health" ]; then HC_ID="$id"; break; fi
  done
  if [ -z "$HC_ID" ]; then
    HC_ID=$(aws route53 create-health-check \
      --caller-reference "matt-grant-research-health-$(date +%s)" \
      --health-check-config "Type=HTTPS,FullyQualifiedDomainName=${HC_HOST},ResourcePath=/api/research/health,Port=443,RequestInterval=30,FailureThreshold=3,MeasureLatency=false" \
      --query "HealthCheck.Id" --output text)
    aws route53 change-tags-for-resource --resource-type healthcheck --resource-id "$HC_ID" \
      --add-tags Key=Name,Value=matt-grant-research-health >/dev/null && echo "health check created: $HC_ID"
  else
    echo "health check exists: $HC_ID"
  fi
  aws cloudwatch put-metric-alarm --region us-east-1 \
    --alarm-name matt-grant-research-stale \
    --alarm-description "Research data is stale (or the site is down) — /api/research/health is failing" \
    --namespace AWS/Route53 --metric-name HealthCheckStatus --statistic Minimum \
    --dimensions "Name=HealthCheckId,Value=${HC_ID}" \
    --period 60 --evaluation-periods 3 --threshold 1 --comparison-operator LessThanThreshold \
    --treat-missing-data breaching \
    --alarm-actions "$TOPIC_ARN" >/dev/null && echo "alarm matt-grant-research-stale set"
else
  echo "(skipping staleness canary — set ALERT_EMAIL to enable)"
fi

# ── 6. Runtime SSM read access (secrets-migration step 1) ─────────────────────────
# Grant the Amplify SSR *compute* role (NOT the build role) scoped read on the
# app's SSM parameters + decrypt of SecureStrings, so getSecret() (web/lib/ssm.ts)
# can fetch secrets at runtime once they stop being baked into the artifact. This
# is the prerequisite for un-baking amplify.yml (infra/SECRETS-MIGRATION.md step 3).
#
# Scoping: ssm:GetParameter(s) limited to /matt-grant/*; kms:Decrypt limited to
# SSM-issued calls only (kms:ViaService condition) so it cannot decrypt anything
# else in the account. The build role's SSM/KMS stays in place until after rotation
# (step 4) — do NOT remove it here.
say "Runtime SSM read access (compute role)"
COMPUTE_ROLE_ARN="$(aws amplify get-app --app-id "$AMPLIFY_APP_ID" --region "$REGION" \
  --query 'app.computeRoleArn' --output text 2>/dev/null || true)"
if [ -z "$COMPUTE_ROLE_ARN" ] || [ "$COMPUTE_ROLE_ARN" = "None" ]; then
  echo "  No compute role on app ${AMPLIFY_APP_ID}. Create one and attach it first:"
  echo "    aws amplify update-app --app-id ${AMPLIFY_APP_ID} --compute-role-arn <roleArn>"
  echo "  (trust policy principal: amplify.amazonaws.com). Then re-run this step."
else
  COMPUTE_ROLE_NAME="${COMPUTE_ROLE_ARN##*/}"
  echo "  compute role: ${COMPUTE_ROLE_NAME}"
  aws iam put-role-policy --role-name "$COMPUTE_ROLE_NAME" \
    --policy-name matt-grant-ssm-runtime-read \
    --policy-document "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadMattGrantParams",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": "arn:aws:ssm:${REGION}:${ACCT}:parameter/matt-grant/*"
    },
    {
      "Sid": "DecryptViaSsmOnly",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "*",
      "Condition": { "StringEquals": { "kms:ViaService": "ssm.${REGION}.amazonaws.com" } }
    }
  ]
}
JSON
)" >/dev/null && echo "  inline policy matt-grant-ssm-runtime-read attached"
fi

say "Done"
echo "Next: verify a manual run — curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" ${BASE_URL}/api/cron/email-drain"
