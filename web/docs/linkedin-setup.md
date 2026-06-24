# LinkedIn setup — two apps, one for each job

The campaign uses **two separate LinkedIn developer apps**, one per job. Keeping them split means the posting app and the login app are reviewed, scoped, and rotated independently.

| LinkedIn app | Client ID | Product it needs | Backs in this repo | Secret lives in |
|---|---|---|---|---|
| **Matt Grant for Congress Auth** | `78lz8h5laq8pja` | Sign In with LinkedIn using OpenID Connect | Staff/public **login** via Clerk `<SignIn />` | Clerk dashboard |
| **Matt Grant for Congress Social Scheduler** | `78bnj5e8vi3haa` | Share on LinkedIn | **Posting** from the Social Command Center | AWS Parameter Store |

Each app needs just **one** redirect URL (the job it does). They don't share credentials.

> **Operational setup, not legal advice.** LinkedIn's API terms and political-content rules are theirs — read them before posting at scale.
>
> Replace `YOUR_DOMAIN` throughout with the deployed origin (e.g. `https://mattgrantforcongress.org`).

---

## Prerequisites

- **Clerk is live:** both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` set (`lib/auth.ts:5`). If blank, `/sign-in` shows "not configured" and no social login renders.
- **You are an admin:** only the `admin` role has `manageSocial` (`lib/rbac.ts`), required to reach `/dashboard/social` and the **Connect** buttons. Add your email to `DASHBOARD_ALLOWLIST` (or an invited staff row) before connecting.
- The **Client Secret** for each app, from its **Auth** tab.
- AWS CLI access (`us-east-1`) to run `infra/setup-aws.sh`.

---

## Part A — Sign In with LinkedIn (Clerk login) · app `78lz8h5laq8pja`

LinkedIn login is rendered automatically by Clerk's `<SignIn />` (`app/sign-in/[[...sign-in]]/page.tsx`) once the connection is enabled — **no app code change**.

1. **Clerk dashboard** → production instance → **User & Authentication → SSO Connections** → **Add connection → For all users → LinkedIn**.
2. Toggle **Use custom credentials**. Clerk reveals an **Authorized Redirect URI** — **copy it**.
3. In the **Auth** app (`78lz8h5laq8pja`) → **Auth** tab → add that URI under *Authorized redirect URLs*.
4. Back in Clerk, paste:
   - **Client ID:** `78lz8h5laq8pja`
   - **Client Secret:** from the Auth app's **Auth** tab
   - **Scopes:** `openid profile email`
5. **Save.** The LinkedIn button now appears on `/sign-in` and `/sign-up`.

**Role on first login:** the `user.created` webhook (`app/api/webhooks/clerk/route.ts`) stamps the role — `DASHBOARD_ALLOWLIST` → invited-staff row → `supporter`. Add a staffer's email to the allowlist (or invite them) **before** they sign in, and set `CLERK_WEBHOOK_SIGNING_SECRET` (without it the webhook is inert and the role defaults to `supporter`).

---

## Part B — Share on LinkedIn (posting) · app `78bnj5e8vi3haa`

The connect flow reads this app's credentials from Parameter Store under `/mattgrant/prod/social/linkedin/<field>` (`lib/social/credentials.ts`). No creds → the channel stays in **manual/staged** mode; loading them flips it to **API** mode.

### 1. Register the posting redirect URL

In the **Social Scheduler** app (`78bnj5e8vi3haa`) → **Auth** tab → *Authorized redirect URLs* → add:

```
https://YOUR_DOMAIN/api/social/callback/linkedin
```

(Exact path served by `app/api/social/callback/[platform]/route.ts`; **no trailing slash**.)

### 2. Load the app credentials

```bash
REGION=us-east-1
DOMAIN=https://YOUR_DOMAIN

aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/linkedin/client_id     --value "78bnj5e8vi3haa"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/linkedin/client_secret --value "<Social Scheduler app secret>"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/linkedin/redirect_uri  --value "$DOMAIN/api/social/callback/linkedin"
```

The `redirect_uri` must match step 1 **byte-for-byte**. (Local/dev override without SSM: `SOCIAL_LINKEDIN_CLIENT_ID`, `SOCIAL_LINKEDIN_CLIENT_SECRET`, `SOCIAL_LINKEDIN_REDIRECT_URI`.)

### 3. Apply IAM + the publishing cron

```bash
BASE_URL=$DOMAIN CRON_SECRET=<your cron secret> bash infra/setup-aws.sh
```

Grants the runtime role `ssm:GetParameter*` on `/mattgrant/prod/social/*` and installs the `matt-grant-social-drain` worker (`rate(1 minute)` → `POST /api/cron/social-drain`).

### 4. Connect + smoke test

Dashboard → **Social** → **Connect** on LinkedIn → consent → back at `/dashboard/social?connected=linkedin`. The tester should read **green** with your name. Schedule a post ~2 minutes out (attach a graphic to exercise image upload) and confirm it lands.

### Member posting vs. organization-page posting

The default scope is **`openid profile w_member_social`** — posts **as the signed-in member** (all the *Share on LinkedIn* product grants). To post **as the campaign Page** (`urn:li:organization:…`):

1. On the **Social Scheduler** app's **Products** page, **Request access** to the **Community Management API** and wait for `w_organization_social` approval.
2. Widen the requested scopes without a code change:
   ```bash
   aws ssm put-parameter --region $REGION --type String --overwrite \
     --name /mattgrant/prod/social/linkedin/scopes \
     --value "openid profile w_member_social w_organization_social"
   ```
   (or env `SOCIAL_LINKEDIN_SCOPES`), then **reconnect**.
3. Set the org author URN for the manual-token path:
   ```bash
   aws ssm put-parameter --region $REGION --type String --overwrite \
     --name /matt-grant/LINKEDIN_AUTHOR_URN --value "urn:li:organization:<id>"
   ```
   > Note: the connect flow currently stores the **member** URN from userinfo; posting *as the org through a connected account* (vs. a manual token) is a documented follow-up — resolving the org URN from `organizationAcls` after CMA approval.

---

## Troubleshooting

- **`redirect_uri` mismatch on connect:** the stored posting `redirect_uri` must equal the URL registered in the Social Scheduler app's Auth tab exactly.
- **LinkedIn button missing on `/sign-in`:** the Clerk connection isn't enabled, or Clerk keys aren't set.
- **Channel stays "manual/staged":** a required Parameter Store field is missing/unreadable, or `setup-aws.sh` hasn't granted the role read access.
- **Connected, then stops posting:** member refresh tokens are only issued to approved apps; if absent the connection degrades to reconnect-on-expiry (`lib/social/oauth/refresh.ts`). Just reconnect.

## See also
- [`google-signin-setup.md`](./google-signin-setup.md) / [`google-youtube-setup.md`](./google-youtube-setup.md) — the Google equivalents.
- [`social-go-live.md`](./social-go-live.md) — all-platform go-live runbook.
- [`social-command-center.md`](./social-command-center.md) — day-to-day composing & scheduling.
