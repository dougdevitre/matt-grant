# Social auto-posting — go-live runbook

How to turn the Social Command Center from **manual/staged** mode into **live API auto-posting** for X, LinkedIn, Facebook, and Instagram. This is the one-time setup the campaign does once per platform; day-to-day use is covered in [`social-command-center.md`](./social-command-center.md).

> **Not to be confused with user login.** This runbook connects the campaign's *own* accounts for **posting**. For **"Sign in with Google / Facebook / LinkedIn"** (end-user login → dashboard), see [`social-auth-runbook.md`](./social-auth-runbook.md).

> **This is operational setup, not legal advice.** Each platform's API terms, review process, and political-content rules are theirs — read them before you post at scale.

---

## How it fails safe

Every publisher checks for credentials first. With **no app credentials in Parameter Store**, each channel reports "not configured" and the composer stays in **staged/manual** mode — posts are saved to the calendar but nothing is sent. Loading the credentials below is what flips a channel to **API** mode. You can go live one platform at a time; the others keep degrading gracefully.

You're done when Dashboard → **Social** → the connection tester shows each platform **green**, and a scheduled test post actually appears on the account.

---

## 1. Register each platform's app

Create (or reuse) a developer app per platform, enable OAuth, and register the **exact callback URL** below. Replace `YOUR_DOMAIN` with the deployed site origin (e.g. `https://mattgrantforcongress.org`). The callback path is served by `app/api/social/callback/[platform]/route.ts`.

| Platform | Callback URL to register | Scopes the app requests | Gotchas |
|---|---|---|---|
| **X** | `https://YOUR_DOMAIN/api/social/callback/x` | `tweet.read tweet.write users.read offline.access` | OAuth 2.0, **confidential client** ("Web App"). `offline.access` is required for token refresh — without it connections expire and stop posting. |
| **LinkedIn** | `https://YOUR_DOMAIN/api/social/callback/linkedin` | `openid profile w_member_social` | Posting **as a person** works with these scopes. Posting **as an Organization/Page** also needs LinkedIn's **Community Management API** product + the `w_organization_social` scope approved. Set `LINKEDIN_AUTHOR_URN` (step 3). |
| **Facebook + Instagram** (one Meta app) | `https://YOUR_DOMAIN/api/social/callback/facebook` | `pages_show_list, pages_read_engagement, pages_manage_posts, business_management, instagram_basic, instagram_content_publish` | Instagram must be a **Business** account **linked to the Facebook Page**. These scopes require Meta **App Review** + **Business verification** before anyone outside the app's dev/test users can post. Connecting `facebook` also surfaces the linked IG account — there's no separate "instagram" connect. |

> Scopes/fields live in code: `lib/social/oauth/x.ts`, `lib/social/oauth/linkedin.ts`, and `META_SCOPES` in `lib/social/metaOAuth.ts`. If you change them there, update this table.

---

## 2. Load app credentials into Parameter Store

Credentials are read from SSM under the prefix **`/mattgrant/prod/social/<platform>/<field>`** (`lib/social/credentials.ts`). Store secrets as **SecureString**. The `redirect_uri` value must **exactly** match the callback URL you registered in step 1.

```bash
REGION=us-east-1
DOMAIN=https://YOUR_DOMAIN

# --- X (client_id / client_secret / redirect_uri) ---
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/x/client_id     --value "XXXX"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/x/client_secret --value "XXXX"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/x/redirect_uri  --value "$DOMAIN/api/social/callback/x"

# --- LinkedIn (client_id / client_secret / redirect_uri) ---
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/linkedin/client_id     --value "XXXX"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/linkedin/client_secret --value "XXXX"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/linkedin/redirect_uri  --value "$DOMAIN/api/social/callback/linkedin"

# --- Meta / Facebook + Instagram (app_id / app_secret / redirect_uri) ---
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/facebook/app_id       --value "XXXX"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/facebook/app_secret   --value "XXXX"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/facebook/redirect_uri --value "$DOMAIN/api/social/callback/facebook"
```

**Field names differ by platform:** X and LinkedIn use `client_id` / `client_secret`; Meta uses `app_id` / `app_secret`.

**Local/dev override:** instead of SSM, any field can be set as an env var named `SOCIAL_<PLATFORM>_<FIELD>` (e.g. `SOCIAL_X_CLIENT_ID`, `SOCIAL_FACEBOOK_APP_SECRET`). The whole prefix is overridable with `SOCIAL_PARAM_PREFIX`.

---

## 3. Set the LinkedIn author URN

LinkedIn shares are published *as* an author. Set the URN the post is attributed to — read via `getSecret` (`lib/ssm.ts`), so it's env-first then `/matt-grant/<NAME>`:

```bash
# Organization page: urn:li:organization:<id>   ·   Person: urn:li:person:<id>
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /matt-grant/LINKEDIN_AUTHOR_URN --value "urn:li:organization:123456"
```

(Or set env `LINKEDIN_AUTHOR_URN`.) Posting as an organization requires the Community Management API + `w_organization_social` from step 1.

---

## 4. Apply IAM + the publishing cron

Re-run the infra script so the runtime role can read the new parameters and the scheduler runs:

```bash
BASE_URL=$DOMAIN CRON_SECRET=... infra/setup-aws.sh
```

This grants the app role `ssm:GetParameter*` on `/mattgrant/prod/social/*` (plus KMS decrypt) and installs the `matt-grant-social-drain` EventBridge rule at `rate(1 minute)` — the worker that publishes scheduled posts when their time arrives.

---

## 5. Connect + verify in the dashboard

1. Sign in as an **admin** → Dashboard → **Social**.
2. Click **Connect** for each platform → complete the OAuth consent → you're redirected back.
3. **Meta only:** pick the Facebook **Page** (the linked Instagram Business account comes with it).
4. Run the **connection tester** — each connected platform should read **green** with the account name.
5. **Smoke test:** compose a post, pick one channel, schedule it ~2 minutes out (attach a graphic to also exercise image upload), and confirm it lands on the account within a cron cycle.

---

## Troubleshooting

- **Channel still says "manual/staged":** a required field is missing or unreadable. Re-check the param names in step 2 (X/LinkedIn `client_*` vs Meta `app_*`) and that step 4 ran so the role can read them.
- **`redirect_uri` mismatch error on connect:** the stored `redirect_uri` must be byte-for-byte the URL registered in the platform app (scheme, host, no trailing slash).
- **Connected, then stops posting after a while:** the token expired. X needs `offline.access` for refresh; the social-drain cron also refreshes tokens nearing expiry as a backstop (`lib/social/oauth/refresh.ts`). Reconnect if a provider revoked the grant.
- **Meta posts fail for non-admins:** the app is still in development / pending App Review, or the IG account isn't a Business account linked to the Page.

## See also
- [`social-command-center.md`](./social-command-center.md) — day-to-day composing, scheduling, and the footprint optimizer.
- [`google-youtube-setup.md`](./google-youtube-setup.md) — Google/YouTube account setup.
