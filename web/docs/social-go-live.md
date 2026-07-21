# Social auto-posting — go-live runbook

How to turn the Social Command Center from **manual/staged** mode into **live API auto-posting** for X, LinkedIn, Facebook, Instagram, **TikTok, YouTube, and Threads**. This is the one-time setup the campaign does once per platform; day-to-day use is covered in [`social-command-center.md`](./social-command-center.md).

> **Video vs. image.** X / LinkedIn / Facebook / Instagram / Threads post the branded **image**. **TikTok** posts it as a photo post; **YouTube** renders it to a short **MP4** and uploads it. TikTok and YouTube also have extra review gates that keep posts private until cleared — see [§6](#6-platform-gates-tiktok-audit-youtube-verification-threads).

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
| **TikTok** | `https://YOUR_DOMAIN/api/social/callback/tiktok` | `user.info.basic,video.publish` | TikTok names the app id **`client_key`** (not `client_id`). The Content Posting API pulls the image from a URL, so the site host must be **domain-verified** in the TikTok developer portal. Until the app passes TikTok's **content-posting audit**, posts are forced **`SELF_ONLY`** ([§6](#6-platform-gates-tiktok-audit-youtube-verification-threads)). |
| **YouTube** (Google app) | `https://YOUR_DOMAIN/api/social/callback/youtube` | `youtube.upload youtube.readonly openid email` | Google account setup is in [`google-youtube-setup.md`](../../docs/google-youtube-setup.md). `youtube.upload` is a **restricted scope** → **Google app verification** required; until then uploads are forced **`private`** ([§6](#6-platform-gates-tiktok-audit-youtube-verification-threads)). `youtube.readonly` is requested too so the dashboard can read the channel name. |

> Scopes/fields live in code: `lib/social/oauth/{x,linkedin,tiktok,youtube}.ts` and `META_SCOPES` in `lib/social/metaOAuth.ts`. If you change them there, update this table. **Threads** has no OAuth connect flow yet — it uses a manual token, see [§6](#6-platform-gates-tiktok-audit-youtube-verification-threads).

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

# --- TikTok (client_KEY / client_secret / redirect_uri) ---
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/tiktok/client_key    --value "XXXX"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/tiktok/client_secret --value "XXXX"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/tiktok/redirect_uri  --value "$DOMAIN/api/social/callback/tiktok"

# --- YouTube / Google (client_id / client_secret / redirect_uri) ---
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/youtube/client_id     --value "XXXX"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/youtube/client_secret --value "XXXX"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/youtube/redirect_uri  --value "$DOMAIN/api/social/callback/youtube"
```

**Field names differ by platform:** X, LinkedIn, and YouTube use `client_id` / `client_secret`; Meta uses `app_id` / `app_secret`; **TikTok uses `client_key`** / `client_secret`.

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

## 6. Platform gates: TikTok audit, YouTube verification, Threads

These three need one more step beyond connecting — they gate what can go public.

**TikTok — content-posting audit.** Until your app clears TikTok's audit, the Content Posting API only allows **`SELF_ONLY`** posts (visible just to the posting account). The publisher defaults to that on purpose (`publish.ts`). Two things to finish:
- **Domain-verify** the site host in the TikTok developer portal (the API pulls the image from a URL on your domain).
- After the audit passes, set the env var **`TIKTOK_PRIVACY_LEVEL`** to TikTok's public value (per their API docs, e.g. `PUBLIC_TO_EVERYONE`) on the runtime. Leave it unset to stay `SELF_ONLY`.

**YouTube — Google app verification.** `youtube.upload` is a Google **restricted scope**, so uploads are forced **`private`** until Google verifies the app. The publisher defaults to `private` (`publish.ts`). After verification, set the env var **`YOUTUBE_PRIVACY_STATUS`** to `public` (or `unlisted`). Account/app setup is in [`google-youtube-setup.md`](../../docs/google-youtube-setup.md).

**Threads — manual token (no OAuth connect yet).** Threads isn't in the dashboard's Connect list. Create a Meta app with the **Threads API**, generate a long-lived **Threads user access token** and note the numeric **Threads user id**, then store both where `getSecret` reads them (env var, or SSM `/matt-grant/<NAME>` as SecureString):
```bash
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /matt-grant/THREADS_ACCESS_TOKEN --value "XXXX"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /matt-grant/THREADS_USER_ID --value "1784XXXXXXXXXXX"
```
Once both are present, the Threads channel flips from staged to API mode like the rest.

> **Manual-token shortcut (any platform).** Instead of the OAuth **Connect** flow, you can drop a ready access token for a channel via `getSecret` names — `X_ACCESS_TOKEN`, `FACEBOOK_PAGE_TOKEN`+`FACEBOOK_PAGE_ID`, `INSTAGRAM_ACCESS_TOKEN`+`INSTAGRAM_USER_ID`, `LINKEDIN_ACCESS_TOKEN`+`LINKEDIN_AUTHOR_URN`, `TIKTOK_ACCESS_TOKEN`, `YOUTUBE_ACCESS_TOKEN` (map in `publish.ts`). Useful for a quick test, but **manual tokens don't auto-refresh** — the OAuth connect (step 5) is preferred for anything ongoing.

---

## Troubleshooting

- **Channel still says "manual/staged":** a required field is missing or unreadable. Re-check the param names in step 2 (X/LinkedIn/YouTube `client_*`, TikTok `client_key`, Meta `app_*`) and that step 4 ran so the role can read them.
- **TikTok posts only I can see:** the app hasn't passed the content-posting audit, so `TIKTOK_PRIVACY_LEVEL` is `SELF_ONLY`. Finish the audit + domain verification, then set the public value (§6).
- **YouTube uploads are private:** Google hasn't verified the app for `youtube.upload`. Complete verification, then set `YOUTUBE_PRIVACY_STATUS=public` (§6).
- **`redirect_uri` mismatch error on connect:** the stored `redirect_uri` must be byte-for-byte the URL registered in the platform app (scheme, host, no trailing slash).
- **Connected, then stops posting after a while:** the token expired. X needs `offline.access` for refresh; the social-drain cron also refreshes tokens nearing expiry as a backstop (`lib/social/oauth/refresh.ts`). Reconnect if a provider revoked the grant.
- **Meta posts fail for non-admins:** the app is still in development / pending App Review, or the IG account isn't a Business account linked to the Page.

## See also
- [`social-command-center.md`](./social-command-center.md) — day-to-day composing, scheduling, and the footprint optimizer.
- [`google-youtube-setup.md`](../../docs/google-youtube-setup.md) — Google/YouTube account setup.
