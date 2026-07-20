# SMS operator runbook — day-to-day texting

**How campaign staff send texts, run the 1:1 inbox, and keep every message compliant.** This is the
practical, open-it-when-you're-working guide. For the one-time Twilio/credentials setup see
`sms-go-live.md`; for the how-it-was-built status report see `admin-team-messaging-status.md`.

> Operational guidance, not legal advice. Texting rules (TCPA, carrier policy) change — when in
> doubt, check with a campaign attorney or your Twilio account before sending.

The campaign texts from a toll-free number, **+1 844-314-7912** (a Twilio Messaging Service). Every
number we text has explicitly opted in, every broadcast carries the FEC disclaimer + STOP, and
broadcasts + staff-initiated texts only go out during quiet hours (9am–8pm Central) — automated
confirmations of a person's own action (keyword reply, signup welcome, donation thank-you) send
immediately. The dashboard enforces all of this for you.

---

## Who can do what

Access is by role. The composer figures out your scope automatically from your login.

| You can… | Admin | Captain | Volunteer / Donor / Supporter / Partner |
|---|---|---|---|
| Draft + send a **test** to your own number | ✅ | ✅ | ❌ |
| Send to the **full opted-in list** | ✅ | ❌ | ❌ |
| Send to **your own team** | ✅ | ✅ (their team) | ❌ |
| Use the **1:1 inbox** (reply to texters) | ✅ | ✅ | ❌ |

- **Admins** run everything: full-list broadcasts, team sends, the inbox, and go-live setup.
- **Captains** can draft, test, text **only their own opted-in team**, and use the inbox. They
  cannot reach the full list.
- **Volunteers and all external tiers** have no texting access.

(Capabilities: `draftSms`, `sendSms`, `sendTeamSms`, `messageIndividuals` in `lib/rbac.ts`.)

---

## Where things live

Everything is under the dashboard's **Comms** section.

| Task | Go to | Nav label |
|---|---|---|
| Send a text blast | `/dashboard/sms` | **Text blasts** |
| Reply to people 1:1 | `/dashboard/messages` (a thread is `/dashboard/messages/<number>`) | **Inbox** |
| Decide the SMS budget (admin) | `/dashboard/sms/spend` | **Spend decider** |
| Finish Twilio setup (admin) | `/dashboard/sms/go-live` | via "Finish setup →" on Text blasts |

---

## Send a broadcast

On **Text blasts** (`/dashboard/sms`):

1. **Pick a template** and fill its fields (see the catalog below), or choose **Custom message** to
   write your own. A live **preview** shows exactly what recipients get, including the disclaimer.
2. **(Optional) Personalize with first name.** Check *"Personalize with first name"* to lead the
   message with `Hi {first}, …`. At send time each person gets their own first name; anyone we don't
   have a name for (general opt-ins) gets **"there"**. Volunteers and team members have names;
   the raw opt-in list may not.
3. **Watch the segment counter.** It shows `chars · segments · encoding`. Plain text is **GSM-7**
   (160 chars per segment). A "special" character — curly quotes, em dashes, emoji, some accents —
   flips the whole message to **UCS-2** (only **70** chars per segment, ~2× the cost). If you see a
   UCS-2 warning, it names the offending character; replace it with plain text.
4. **Choose the audience.**
   - **Admins** pick any of: **All opted-in**, **Volunteers**, **by account role**, or **by
     volunteer role/door**. Counts show how many opted-in people each selection reaches.
   - **Admins can then NARROW the selection** with the "Narrow by county / voter tag" chips —
     the six MO-02 counties, school districts (once the crosswalk is generated, below), voter
     segments (MOBILIZE/BANK/…), **Not yet voted** (skips numbers confirmed voted — GOTV chase
     mode), or a list of ZIPs. Filters match data carried on the consent row itself: county/ZIP
     the person told the SMS vote agent, plus the tags the enrichment job writes
     (`npm run enrich:sms` — run it nightly during the chase window so "Not yet voted" tracks
     the daily ballot returns). Filters only ever shrink the audience; a geo-filtered send
     reaches only numbers with known geography. Chips are hidden until any tags exist.

     *School-district chips need a one-time data generation* (the campaign never guesses
     district boundaries): download the NCES EDGE district-to-county and district-to-ZCTA
     relationship files from https://nces.ed.gov/programs/edge/geographic/relationshipfiles,
     run `npm run build:district-crosswalk -- --lea-county <file> --lea-zcta <file>
     --retrieved YYYY-MM-DD`, verify district names against the DESE School Directory
     (https://dese.mo.gov/directory), run the test suite, commit the regenerated
     `lib/sms/school-districts.data.ts`, then re-run `npm run enrich:sms`. ZIPs that cross
     district lines stay untagged by design. District targeting is for geographic relevance
     (nearest early-vote site, events) — never to imply local education policy positions.
   - **Captains** see **"Texting your team only — N opted-in volunteers"** — the send is
     automatically scoped to their own roster (optionally narrowed by volunteer role). Captains
     can't widen it to the full list.
5. **Deciding the budget? Use the Spend Decider.** Admins have **Comms → Spend decider**
   (`/dashboard/sms/spend`): paste the message, check the Twilio per-segment pricing defaults
   (verify against twilio.com/en-us/sms/pricing/us — they go stale), enter list size, planned
   sends, and a total budget, and it returns the **Max texts** cap to type into the composer plus
   a table of exactly which voter-priority groups the capped blast reaches. Figures are planning
   estimates; reconcile real spend against the Twilio console and record it as an FEC disbursement.
6. **Priority ordering is automatic.** Every blast queues **highest-likelihood voters first** —
   ranked by the voter segment (MOBILIZE > BANK > PERSUADE > PROSPECT) with turnout score as the
   within-segment tie-break, using the tags the enrichment job wrote (`npm run enrich:sms`).
   Numbers with no voter match go last but are still sent. The optional **Max texts** field caps a
   blast to the top N by priority — the cut hits only the lowest-priority tail, and the
   confirmation reports "Capped to the N highest-priority of M." Because the queue drains in
   order, even an uncapped blast that spans a quiet-hours cutoff reaches the best targets first.
7. **Send a test to yourself first.** Enter your own opted-in mobile and hit **Send test**. Always
   do this before a real blast. (Your number must already be opted in — text the keyword first.)
8. **(Optional) Schedule for later.** Pick a date/time. Texts only leave during quiet hours
   (9am–8pm CT); a time outside that waits for the next window.
9. **Send.** Confirm the audience in the prompt. The blast queues and sends in the background,
   respecting quiet hours. Track progress under **Recent sends**.

---

## Template catalog

Templates come from `SMS_TEMPLATES` (`lib/sms/templates.ts`). Every one automatically gets the
compliance suffix appended before it sends.

| Template | Fields | Use it for | Audience |
|---|---|---|---|
| **Event reminder** | what, when, where | Nudge supporters about an upcoming event | Voter-facing |
| **GOTV reminder** | days (leave blank to auto-fill) | Get-out-the-vote push; the countdown to the Aug 4 primary fills in automatically | Voter-facing |
| **Priority spotlight** | priority, note (optional) | Update on one of Matt's four priorities; deep-links to `/issues/<slug>` | Voter-facing |
| **Team update (internal)** | message | A logistics note or alert to the team | Internal / team |
| **Shift reminder (internal)** | activity, when, where | Remind volunteers of a canvass or phone-bank shift | Internal / team |
| **Captain brief (internal)** | focus, ask | A coordination brief for captains | Internal / team |
| **Custom message** | body | Write your own short message | Either |

Pair the **internal** templates with an internal audience (Volunteers, the Captain account role, or
your own team) — not the full opt-in list.

---

## The 1:1 inbox

**Inbox** (`/dashboard/messages`) is for real conversations — anyone who texts the campaign shows up
here, and you can reply one-to-one.

- **Reply to anyone who texts in.** Even someone who isn't on the broadcast list can be answered
  once they've texted first; the thread header says **"texted us first — you can reply"** vs. the
  opted-in status used for broadcast eligibility.
- **Sender identification is automatic.** The **first** outbound message in a thread is prefixed
  with **"Matt Grant for Congress:"** and includes a one-time "Reply STOP to opt out." so recipients
  know who's texting (this prevents carrier "unknown sender" spam flags). Later replies stay short.
- **One-tap on-topic replies.** The reply box offers link/snippet chips for Matt's priorities and
  common asks (vote, events, donate, volunteer). Suggestions matching the inbound message surface
  first, so a texter asking about corruption gets the family-courts plan link one tap away.
- A **character/segment counter** in the reply box warns you if a link pushes the reply to a second
  segment or UCS-2.

---

## How people opt in

We text **only** numbers that have explicitly opted in (the consent ledger is the hard gate). There
are three ways in:

1. **Text the keyword.** Someone texts **`MATT`** to **+1 844-314-7912** and gets a welcome reply
   with a join link. (Keyword aliases like DONATE, VOLUNTEER, EVENTS, VOTE also opt a person in and
   reply with the matching link.)

   **VOTE (aliases VOTING, EARLY, EARLYVOTE) runs the vote agent** (`lib/sms/votebot.ts`) instead
   of a static link: if the thread already knows the person's county it replies with that county's
   early-vote info (election authority, office, phone, live deadlines); otherwise it asks which of
   the six MO-02 counties they vote in (county name or ZIP). The next non-keyword text is read as
   the answer — a match is remembered on the conversation and consent row (self-reported geography
   for audience targeting), while an answer the agent can't parse gets a fallback link to
   `/vote/absentee` **and still lands in the Inbox** for a human follow-up. An unanswered county
   question expires after 24 hours.
2. **The web checkbox.** On the join/updates form, the box **"Text me campaign updates. Msg & data
   rates may apply; reply STOP to opt out."** — checking it (with a mobile number) opts them in.
3. **The WinRed donation checkbox.** A donor who checks the SMS-consent box (`sms_opt_in`) on the
   WinRed form is opted in and gets an automatic thank-you text. Because that's a broad
   campaign-SMS opt-in, those donors are then reachable by "All opted-in" broadcasts too.

**STOP / START / HELP are handled automatically** (`app/api/webhooks/twilio/route.ts`):

- **STOP** (also STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) → the number is opted out immediately and
  mirrored to the volunteer roster. The carrier sends the confirmation.
- **START** (also YES, UNSTOP) → re-subscribes and clears the opt-out, with a welcome reply.
- **HELP** → an automatic reply identifying the campaign with the STOP instruction and contact email.

---

## The rules (compliance) — enforced for you

- **Opt-in gate.** Every send is intersected with the consent ledger. A number with no `opted_in`
  record is never texted, and the queue re-checks at send in case someone texts STOP in between.
- **Quiet hours.** Broadcasts and staff-initiated one-off texts (e.g. a task assignment) go out only
  **9am–8pm Central** — a queued/scheduled blast waits for the next window, and a task text sent at
  night is skipped. (Deliberately tighter than the legal 8am–9pm.) The one deliberate exception:
  **automated confirmations of the person's own action** — the keyword auto-reply, a signup
  welcome, a donation thank-you — send immediately, because the person is actively engaged at that
  moment.
- **The disclaimer rides on every broadcast:** `- Paid for by Matt Grant for Congress. Reply STOP to
  opt out.` — you don't add it; the system appends it.
- **Keep copy GSM-7.** Plain hyphens/quotes, no em dashes or emoji. One stray special character
  doubles the segment cost of the whole message. The composer flags it.
- **Never buy or upload numbers.** Grow the list only through the opt-in paths above.

---

## Troubleshooting — "why didn't my text send?"

- **"…isn't opted in."** That number has no opt-in on record. It must text the keyword (or check a
  web/WinRed box) first. Test numbers included.
- **Queued but not delivering.** It's probably outside quiet hours (9am–8pm CT) — it'll send at the
  next window. Check **Recent sends** for status.
- **"Texting isn't configured yet."** Twilio credentials aren't loaded. An admin needs to finish
  **SMS go-live** (`/dashboard/sms/go-live` → `sms-go-live.md`).
- **A specific number never gets anything.** It may be **blocked** (moderation) or have texted STOP.
  Blocked numbers are fully inert — no send, no reply.
- **Captain sees "No opted-in volunteers on your team."** No one on that captain's roster is opted
  in yet — recruit opt-ins, or confirm volunteers are assigned to that captain.
- **A text cost 2 segments unexpectedly.** A non-GSM character forced UCS-2 — check the composer's
  encoding warning and replace the flagged character.

---

## See also

- [`sms-go-live.md`](./sms-go-live.md) — one-time Twilio setup, credentials, and the go-live test checklist.
- [`admin-team-messaging-status.md`](./admin-team-messaging-status.md) — how the messaging system was built (status + design).
- [`messaging-rbac.md`](./messaging-rbac.md) — the messaging permission model in depth.
- [`roles-and-permissions.md`](./roles-and-permissions.md) — the full role/capability matrix.
