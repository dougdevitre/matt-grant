# Google / YouTube setup — posting Shorts from the scheduler

How to turn the Social Command Center's **YouTube** channel from manual/staged into live API posting. YouTube has no image-post API, so the scheduler renders the composer's still graphic into a short vertical MP4 (`lib/social/video.ts`) and uploads it as a **Short** (`publishToYouTube` in `lib/social/publish.ts`) via Google OAuth2. The provider is `lib/social/oauth/youtube.ts`.

> **Operational setup, not legal advice.** Google's API terms, the YouTube restricted-scope audit, and political-content rules are theirs — read them before posting at scale.

> **This is a *different* Google integration than staff login.** Google **sign-in** (Clerk) uses basic, non-restricted scopes and is documented in [`google-signin-setup.md`](./google-signin-setup.md). Use a **separate OAuth client** for posting — never add the restricted `youtube.upload` scope to the login client, or you drag the login flow into Google's audit. One Google Cloud **project** can hold both clients.

---

## How it fails safe

With no app credentials in Parameter Store the YouTube channel reports "not configured" and stays in **manual/staged** mode — nothing is uploaded. Loading the credentials flips it to **API** mode.

---

## 1. Create the Google Cloud OAuth app

1. **Google Cloud Console** → create or select a project (e.g. *Matt Grant for Congress*).
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → OAuth consent screen**:
   - User type **External**; fill app name, support email, developer contact.
   - **Scopes** → add the restricted scope `https://www.googleapis.com/auth/youtube.upload` (the provider also requests `openid email`).
   - **Test users** → add the campaign Google account(s) that will post. While the app is **unverified**, only test users can connect and uploads must stay **private** (see step 5).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - **Authorized redirect URI:** `https://YOUR_DOMAIN/api/social/callback/youtube` (exact path served by `app/api/social/callback/[platform]/route.ts`; **no trailing slash**).
   - Save the **Client ID** and **Client secret**.

> **Restricted-scope gate.** `youtube.upload` is a *restricted* scope. For anyone outside the test-user list to connect — and for uploads to be public — Google requires **OAuth app verification** (a security/brand review, sometimes a third-party audit). Until then, keep posting limited to test users and `privacyStatus=private`.

---

## 2. Load the credentials into Parameter Store

Read by `lib/social/credentials.ts` under `/mattgrant/prod/social/youtube/<field>`. Store secrets as **SecureString**.

```bash
REGION=us-east-1
DOMAIN=https://YOUR_DOMAIN

aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/youtube/client_id     --value "<Google Client ID>"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/youtube/client_secret --value "<Google Client secret>"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/youtube/redirect_uri  --value "$DOMAIN/api/social/callback/youtube"
```

The `redirect_uri` must match the Authorized redirect URI from step 1 **byte-for-byte**. (Local/dev override without SSM: `SOCIAL_YOUTUBE_CLIENT_ID`, `SOCIAL_YOUTUBE_CLIENT_SECRET`, `SOCIAL_YOUTUBE_REDIRECT_URI`.)

**Upload visibility:** uploads default to `private` while the app is unverified. Once Google verifies the restricted scope, set `YOUTUBE_PRIVACY_STATUS=public` (or `unlisted`) in the deploy env to publish openly.

---

## 3. Apply IAM + the publishing cron

```bash
BASE_URL=$DOMAIN CRON_SECRET=<your cron secret> bash infra/setup-aws.sh
```

Grants the runtime role `ssm:GetParameter*` on `/mattgrant/prod/social/*` (+ KMS decrypt) and installs the `matt-grant-social-drain` EventBridge rule (`rate(1 minute)` → `POST /api/cron/social-drain`, `Authorization: Bearer <CRON_SECRET>`). `BASE_URL` and `CRON_SECRET` are required.

---

## 4. Connect + smoke test

1. Sign in as an **admin** (only the `admin` role has `manageSocial`) → Dashboard → **Social**.
2. Click **Connect** on YouTube → Google consent → redirected back to `/dashboard/social?connected=youtube`. The provider uses **PKCE** + `access_type=offline` + `prompt=consent`, so Google returns a **refresh token** (it is not rotated; we keep the original).
3. The connection tester should read **green** with the channel title.
4. Compose a post, attach an on-brand graphic, select **only** YouTube, schedule ~2 minutes out. The drain renders the still → a 1080×1920 H.264 MP4 (bundled static **ffmpeg**, ~1–3s) and uploads it as a Short via the resumable `videos.insert` flow. Confirm it appears on the channel (as **private** until verified).

---

## Manual token fallback (testing)

Instead of the OAuth connect flow, set a flat token: `YOUTUBE_ACCESS_TOKEN` (read via `lib/ssm.ts`, env-first then `/matt-grant/<NAME>`). Useful for a quick test without registering the app.

---

## Troubleshooting

- **Channel stays "manual/staged":** a required Parameter Store field is missing/unreadable, or `setup-aws.sh` hasn't granted the role read access.
- **`redirect_uri_mismatch`:** the stored `redirect_uri` must equal the Authorized redirect URI in the Google client exactly.
- **`access_denied` / only test users can connect:** the app is unverified — add the account under **Test users**, or complete Google verification.
- **Connected, then stops posting:** missing refresh token. Re-connect; the consent screen must grant offline access (the provider already sends `access_type=offline` + `prompt=consent`).
- **ffmpeg/bundle weight:** a single-still encode is light, but if the SSR Lambda bundle limits bite, move the render to a dedicated Lambda or MediaConvert (noted in `social-command-center.md`).

## See also
- [`google-signin-setup.md`](./google-signin-setup.md) — Sign in with Google (Clerk staff + public login).
- [`social-go-live.md`](./social-go-live.md) — the all-platform go-live runbook.
- [`social-command-center.md`](./social-command-center.md) — day-to-day composing & scheduling.
