# Campaign service accounts — for Matt to create

So the **committee owns its own services** (cleaner for FEC + continuity), please set
up the accounts below using the **committee email** and the committee card. They're
listed **highest priority first**.

**How to send me access — securely:** never paste a key into email/text/Slack. For
each, either **(a) add me as a team member / admin** in that service, or **(b) send
the key via a one-time link** (I'll send you a 1Password "send" / onetimesecret link
to drop it into). Each link self-destructs after one view.

> Clerk (staff login) is **handled separately — I'm setting that up**. The Google /
> Facebook / LinkedIn **login** apps below feed into it, so I'll wire those in.

---

## P1 — Start now (live site + things that take days to approve)

### 1. WinRed — donation tracking  *(you already have WinRed)*

The donate button works, but donations aren't recorded back into our system yet
because the webhook isn't connected.

- **What I need:** access to WinRed → Settings → Webhooks (add me as a member), or
  add a webhook there with a secret value I'll give you.
- **Cost:** none (already active).

### 2. Anthropic — the AI features

Powers the AI writing/press tools on the site.

- **Create:** <https://console.anthropic.com> (committee email) → add a payment
  method (~$20 credit to start) → Settings → API Keys → Create Key.
- **Send me:** the API key, or add me under Settings → Members.
- **Cost:** usage-based; a small balance lasts a long time at our volume.

### 3. Twilio — voter texting  ⚠️ *start this first; approval takes several days*

For sending campaign texts (GOTV, volunteer coordination).

- **Create:** <https://www.twilio.com> (committee email + billing) → buy a **toll-free**
  number (the campaign texts from a toll-free sender, +1 844-314-7912).
- **Register for political texting (required):** because the sender is toll-free, this is
  Twilio **Toll-Free Verification** — *not* A2P 10DLC (10DLC applies only if you text from a
  local 10-digit long code instead). US carriers require verification for any campaign SMS,
  and **political** use needs the committee's legal info (FEC committee name, EIN, address,
  website). This review can take **several business days** — which is why it's first.
- **Send me:** the **Account SID**, **Auth Token**, and the **Messaging Service SID** (or add
  me as a user). The app sends through a **Messaging Service**, so create one in Twilio and
  attach the toll-free number to it — the Messaging Service SID is the piece the app needs
  (a raw number alone won't work).
- **Cost:** pay-as-you-go per text + a small monthly number fee.

---

## Social media — three separate layers

There are three different things here; tackle them in order. **(a)** is quick and
high-value; **(b)** and **(c)** are developer apps that can take time/review.

### a. Account access — do this first

One official campaign account per platform (committee email), and **add me as
admin/manager** so we can post and pull analytics:

- **Facebook Page** — Meta Business Suite → People → add admin
- **Instagram** — link to the FB Page in Meta Business Suite
- **X (Twitter)** — share login via 1Password, or X delegate access
- **YouTube** — Brand Account → Settings → Managers
- **LinkedIn** — campaign Page → admin
- **TikTok**, **Truth Social** *(GOP primary audience)* — share login via 1Password

> Secure the handles you want **now**, even if we don't post everywhere yet.

### b. "Sign in with…" login apps (OAuth) — Google, Facebook, LinkedIn

So staff/supporters can log in with these. Each is a **developer app** that issues a
**Client ID + Client Secret**; create it under the committee and send me both — I plug
them into the login system.

- **Google** — Google Cloud Console (<https://console.cloud.google.com>) → new project
  → APIs & Services → Credentials → OAuth client ID. *(Easiest: just add me as an
  **Owner** on the project and I build the credentials myself — full step-by-step in
  [`docs/google-youtube-setup.md`](./google-youtube-setup.md).)*
- **Facebook** — Meta for Developers (<https://developers.facebook.com>) → Create App
  → add **Facebook Login**.
- **LinkedIn** — LinkedIn Developers (<https://developer.linkedin.com>) → Create App →
  add **Sign In with LinkedIn using OpenID Connect**.

### c. Posting APIs (publish/schedule content programmatically)

These let us post from our tools. Heads-up: most require **app review**, so start
early. Same idea — create under the committee, send me the app credentials/tokens.

- **Meta Graph API** (Facebook Page + Instagram) — same Meta app as (b); request the
  posting permissions (review-gated).
- **LinkedIn** — Community Management / Posts API (access request + review).
- **X (Twitter) API** — developer.x.com; note paid tiers (~$100/mo for Basic).
- **YouTube Data API** — enable it in the same Google Cloud project as (b). Channel
  uploads also need me added as a **Manager** on the YouTube Brand Account — see
  [`docs/google-youtube-setup.md`](./google-youtube-setup.md).

---

## P2 — Only if we use in-store printing

### 4. Walgreens — same-day photo prints

Lets supporters print flyers/signs at a local Walgreens.

- **Create:** register on the Walgreens developer / affiliate portal (committee email).
- **Send me:** API key, affiliate ID, publisher ID.
- **Cost:** none to register.

---

## P3 — Free government data keys (quick, low urgency)

All **free**, ~2 minutes each (email + "request a key"). Send me each key.

- **FEC** (campaign-finance data) — <https://api.data.gov/signup/>
- **Congress.gov** (voting record / bills) — <https://api.congress.gov/sign-up/>
- **U.S. Census** (district demographics) — <https://api.census.gov/data/key_signup.html>
- **Open States** (state-legislature records) — <https://open.pluralpolicy.com/accounts/profile/>

---

## Not on your list (I handle these)

- **Clerk** — staff login (I'm setting it up; the Google/Facebook/LinkedIn login apps feed into it).
- **AWS / email sending / domain** — infrastructure, already running.
- **`CRON_SECRET`, `UNSUB_SECRET`** — internal app secrets I generate; no account needed.

## Send-back summary

For each: **"added you as a member/admin"** or **"here's the one-time link."** If
short on time: **Twilio (start the registration!) → WinRed → Anthropic → social
handles → the login (OAuth) apps → posting APIs → Walgreens → free data keys.**
