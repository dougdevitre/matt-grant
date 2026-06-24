# LinkedIn setup — one app, two jobs

The campaign's single LinkedIn developer app — **Matt Grant for Congress Auth**, Client ID **`78lz8h5laq8pja`** — powers two separate integrations:

| Product on the LinkedIn app | What it backs in this repo | Where the secret lives |
|---|---|---|
| **Sign In with LinkedIn using OpenID Connect** | Staff **login** for `/dashboard` (a social provider inside Clerk's `<SignIn />`) | Clerk dashboard |
| **Share on LinkedIn** | The **Social Command Center** publishing a scheduled post to LinkedIn (`lib/social/oauth/linkedin.ts` → `lib/social/publish.ts`) | AWS Parameter Store |

One app, one Client ID / Client Secret. The two jobs differ only in **which redirect URL** LinkedIn calls back and **where you store the secret**. Register **both** redirect URLs in the app's **Auth** tab (LinkedIn allows several).

> **Operational setup, not legal advice.** LinkedIn's API terms and political-content rules are theirs — read them before posting at scale. This doc covers wiring, not compliance.

---

## Redirect URLs to add (Auth tab → "Authorized redirect URLs for your app")

Replace `YOUR_DOMAIN` with the deployed origin (e.g. `https://mattgrantforcongress.org`).

| Job | Redirect URL | Source of the exact value |
|---|---|---|
| Clerk login | *(copy from Clerk — see Part A)* | Clerk dashboard shows the precise URL when you enable LinkedIn |
| Posting | `https://YOUR_DOMAIN/api/social/callback/linkedin` | Served by `app/api/social/callback/[platform]/route.ts` |

Both can coexist on the same app. The posting URL must match the `redirect_uri` you store in Parameter Store **byte-for-byte** (scheme, host, no trailing slash).

---

## Part A — Sign In with LinkedIn (Clerk login)

LinkedIn social login is rendered automatically by Clerk's `<SignIn />` component (`app/sign-in/[[...sign-in]]/page.tsx`) once the connection is enabled in the Clerk dashboard — **no app code change is required**.

1. **Clerk dashboard** → your production instance → **User & Authentication → SSO Connections** (a.k.a. Social Connections) → **Add connection → For all users → LinkedIn**.
2. Toggle **Use custom credentials**. Clerk reveals an **Authorized Redirect URI** — copy it.
3. **LinkedIn app → Auth tab** → add that URI under *Authorized redirect URLs*. (Leave the posting URL there too.)
4. Back in Clerk, paste:
   - **Client ID:** `78lz8h5laq8pja`
   - **Client Secret:** from the LinkedIn app's **Auth** tab.
   - **Scopes:** `openid profile email` (the *Sign In with OpenID Connect* product grants these).
5. Save. The LinkedIn button now appears on `/sign-in` and `/sign-up`.

**Role on first login is automatic.** A LinkedIn sign-in creates a Clerk user with a verified email; the `user.created` webhook (`app/api/webhooks/clerk/route.ts`) stamps the RBAC role from `DASHBOARD_ALLOWLIST` → invited-staff row → `supporter` floor. To grant a LinkedIn-authenticated staffer dashboard access, add their email to `DASHBOARD_ALLOWLIST` or invite them as staff **before** they sign in. (Requires `CLERK_WEBHOOK_SIGNING_SECRET` — without it the webhook is inert and the role defaults to `supporter`.)

---

## Part B — Share on LinkedIn (scheduled posting)

The OAuth connect flow uses the app credentials in Parameter Store under `/mattgrant/prod/social/linkedin/<field>` (`lib/social/credentials.ts`). With no creds the LinkedIn channel degrades to **manual/staged** mode; loading them flips it to **API** mode.

### 1. Load the app credentials

```bash
REGION=us-east-1
DOMAIN=https://YOUR_DOMAIN

aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/linkedin/client_id     --value "78lz8h5laq8pja"
aws ssm put-parameter --region $REGION --type SecureString --overwrite \
  --name /mattgrant/prod/social/linkedin/client_secret --value "<from the LinkedIn Auth tab>"
aws ssm put-parameter --region $REGION --type String --overwrite \
  --name /mattgrant/prod/social/linkedin/redirect_uri  --value "$DOMAIN/api/social/callback/linkedin"
```

(Local/dev override without SSM: `SOCIAL_LINKEDIN_CLIENT_ID`, `SOCIAL_LINKEDIN_CLIENT_SECRET`, `SOCIAL_LINKEDIN_REDIRECT_URI`.)

### 2. Apply IAM + the publishing cron

```bash
BASE_URL=$DOMAIN CRON_SECRET=... infra/setup-aws.sh
```

Grants the runtime role `ssm:GetParameter*` on `/mattgrant/prod/social/*` and installs the `matt-grant-social-drain` worker.

### 3. Connect + smoke test

Dashboard → **Social** → **Connect** on LinkedIn → consent → back. The connection tester should read **green** with your name. Schedule a post ~2 minutes out (attach a graphic to exercise image upload) and confirm it lands.

### Member posting vs. organization-page posting

The default scope is **`openid profile w_member_social`** — it posts **as the signed-in member** (the *Share on LinkedIn* product grants exactly this). The connect flow resolves your `urn:li:person:…` from OpenID userinfo and posts as you.

To post **as the campaign Page** (`urn:li:organization:…`) you must first request LinkedIn's **Community Management API** product (it shows as *Request access* on your app's Products page) and get `w_organization_social` approved. The posting adapter (`publishToLinkedIn`) already accepts an organization author URN — the only thing the member flow can't do is *request* that scope. Two paths once approved:

- **No code change:** widen the requested scopes via the override (env `SOCIAL_LINKEDIN_SCOPES` or SSM `/mattgrant/prod/social/linkedin/scopes`), e.g. `openid profile w_member_social w_organization_social`, then reconnect.
- **Org author URN:** set the org URN for the manual-token path —
  ```bash
  aws ssm put-parameter --region $REGION --type String --overwrite \
    --name /matt-grant/LINKEDIN_AUTHOR_URN --value "urn:li:organization:<id>"
  ```
  > Note: the in-app connect flow currently stores the **member** URN it reads from userinfo, so posting *as the org* via a connected account (rather than a manual token) is a documented follow-up — resolving the org URN from `organizationAcls` after CMA approval.

---

## Troubleshooting

- **`redirect_uri` mismatch on connect:** the stored posting `redirect_uri` must equal the URL registered in the LinkedIn Auth tab exactly.
- **LinkedIn button missing on `/sign-in`:** the Clerk connection isn't enabled, or Clerk keys aren't set (the page shows the "not configured" notice). See `.env.example` Clerk section.
- **Channel stays "manual/staged":** a required Parameter Store field is missing/unreadable, or `setup-aws.sh` hasn't granted the role read access.
- **Connected, then stops posting:** member refresh tokens are only issued to approved apps; if absent the connection degrades to reconnect-on-expiry (`lib/social/oauth/refresh.ts`). Just reconnect.

## See also
- [`social-go-live.md`](./social-go-live.md) — the all-platform go-live runbook.
- [`social-command-center.md`](./social-command-center.md) — day-to-day composing & scheduling.
