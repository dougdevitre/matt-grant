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
# Amplify/Lambda log groups default to "never expire". Cap retention to control
# cost. Applies to existing Amplify + Lambda groups; new groups created later
# should be re-run through this (or set at creation in IaC).
say "Log retention → ${LOG_RETENTION_DAYS}d"
for prefix in /aws/amplify /aws/lambda; do
  for lg in $(aws logs describe-log-groups --log-group-name-prefix "$prefix" \
                --region "$REGION" --query 'logGroups[].logGroupName' --output text); do
    aws logs put-retention-policy --log-group-name "$lg" \
      --retention-in-days "$LOG_RETENTION_DAYS" --region "$REGION" && echo "  $lg"
  done
done

# ── 3. Scheduled jobs (EventBridge Scheduler → API destination) ──────────────────
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
      --invocation-rate-limit-per-second 10 >/dev/null && echo "  api-destination $name"
  fi
  aws events describe-api-destination --name "$name" --region "$REGION" --query ApiDestinationArn --output text
}
DEST_INGEST="$(create_destination matt-grant-ingest /api/research/ingest)"
DEST_DRAIN="$(create_destination matt-grant-email-drain /api/cron/email-drain)"

# Execution role the Scheduler assumes to invoke the API destinations.
ROLE_NAME="matt-grant-scheduler-role"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"scheduler.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null && echo "role $ROLE_NAME created"
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name invoke-api-destinations \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"events:InvokeApiDestination\",\"Resource\":[\"${DEST_INGEST}\",\"${DEST_DRAIN}\"]}]}" \
  >/dev/null && echo "scheduler policy attached"
ROLE_ARN="arn:aws:iam::${ACCT}:role/${ROLE_NAME}"

create_schedule() { # name cron destArn
  local name="$1" expr="$2" dest="$3"
  aws scheduler create-schedule --name "$name" --region "$REGION" \
    --schedule-expression "$expr" --flexible-time-window '{"Mode":"OFF"}' \
    --target "{\"Arn\":\"${dest}\",\"RoleArn\":\"${ROLE_ARN}\",\"RetryPolicy\":{\"MaximumRetryAttempts\":2}}" \
    2>/dev/null && echo "  schedule $name created" \
    || aws scheduler update-schedule --name "$name" --region "$REGION" \
         --schedule-expression "$expr" --flexible-time-window '{"Mode":"OFF"}' \
         --target "{\"Arn\":\"${dest}\",\"RoleArn\":\"${ROLE_ARN}\",\"RetryPolicy\":{\"MaximumRetryAttempts\":2}}" \
         >/dev/null && echo "  schedule $name updated"
}
create_schedule matt-grant-research-ingest "cron(0 8 ? * MON *)" "$DEST_INGEST"
create_schedule matt-grant-email-drain     "rate(1 minute)"      "$DEST_DRAIN"

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

say "Done"
echo "Next: verify a manual run — curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" ${BASE_URL}/api/cron/email-drain"
