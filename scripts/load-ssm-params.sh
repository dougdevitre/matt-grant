#!/usr/bin/env bash
# Load all matt-grant parameters into AWS SSM Parameter Store.
#
# HOW TO USE (AWS CloudShell — https://console.aws.amazon.com/cloudshell):
#   1. Open the CloudShell editor:  nano load-ssm-params.sh   (or use the file menu)
#   2. Paste this whole file, fill in the values in the "EDIT THESE" block.
#   3. Run it:  bash load-ssm-params.sh
#
# Param names == env var names (basename), so syncing to Vercel/Amplify is a
# direct map. Secrets are stored as SecureString; config as String.

set -euo pipefail

REGION="us-east-1"
PREFIX="/matt-grant"

# ============================ EDIT THESE =============================
# --- secrets (SecureString) ---
CLERK_SECRET_KEY="sk_live_xxxxxxxx"
CONGRESS_GOV_API_KEY="xxxxxxxx"               # https://api.congress.gov/sign-up/
CRON_SECRET="$(openssl rand -hex 32)"          # or paste your own fixed value

# --- public / non-secret config (String) ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_xxxxxxxx"
DYNAMODB_TABLE="matt-grant"                    # DB is DynamoDB; creds come from the IAM role
AWS_REGION="us-east-1"
S3_ASSETS_BUCKET="matt-grant-assets-CHANGE_ME" # from the create-bucket step
ASSETS_CDN_URL="https://dxxxxxxxx.cloudfront.net"  # CloudFront domain (after you create it)
RESEARCH_BIOGUIDE_ID="W000812"                 # Ann Wagner, MO-02
RESEARCH_VOTE_YEAR="2025"
RESEARCH_FROM_ROLL="1"
RESEARCH_TO_ROLL="60"
# ====================================================================

put() { # name value type
  aws ssm put-parameter --region "$REGION" --name "$PREFIX/$1" \
    --value "$2" --type "$3" --overwrite >/dev/null
  echo "  set $PREFIX/$1 ($3)"
}

echo "Loading parameters into SSM under $PREFIX ($REGION) ..."
put CLERK_SECRET_KEY                  "$CLERK_SECRET_KEY"                  SecureString
put CONGRESS_GOV_API_KEY              "$CONGRESS_GOV_API_KEY"              SecureString
put CRON_SECRET                       "$CRON_SECRET"                       SecureString
put NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" String
put DYNAMODB_TABLE                    "$DYNAMODB_TABLE"                    String
put AWS_REGION                        "$AWS_REGION"                        String
put S3_ASSETS_BUCKET                  "$S3_ASSETS_BUCKET"                  String
put ASSETS_CDN_URL                    "$ASSETS_CDN_URL"                    String
put RESEARCH_BIOGUIDE_ID              "$RESEARCH_BIOGUIDE_ID"              String
put RESEARCH_VOTE_YEAR                "$RESEARCH_VOTE_YEAR"                String
put RESEARCH_FROM_ROLL                "$RESEARCH_FROM_ROLL"               String
put RESEARCH_TO_ROLL                  "$RESEARCH_TO_ROLL"                 String

echo
echo "Stored parameters:"
aws ssm get-parameters-by-path --region "$REGION" --path "$PREFIX" --recursive \
  --query "Parameters[].{Name:Name,Type:Type}" --output table
