# SMS / Text Messaging Compliance & Templates

Everything the campaign needs to run compliant text messaging for Matt Grant for Congress: carrier verification content, opt-in/consent language, ready-to-send message templates, and a TCPA + FEC compliance checklist. Built for the campaign's Twilio toll-free sender (+1 844-314-7912) operating under the "Matt Grant for Congress" Messaging Service. Every template carries the required FEC disclaimer (*Paid for by Matt Grant for Congress.*) and STOP opt-out language.

```mermaid
flowchart TD
    A[Want to send a campaign text] --> B{Is the toll-free number Verified?}
    B -->|No / In Review| C[Hold the queue -- sends fail with error 30032]
    B -->|Yes, Verified| D{Do you have prior express consent for every recipient?}
    D -->|No| E[Do not send -- collect opt-in first]
    D -->|Yes| F{Is it 8am-9pm in the recipient's local time?}
    F -->|No| G[Schedule for allowed hours]
    F -->|Yes| H[Send message with sender ID + Paid-for disclaimer + STOP]
    H --> I{Recipient replies STOP?}
    I -->|Yes| J[Honor opt-out immediately, suppress number permanently]
    I -->|No| H
```

---

## 1. Toll-Free Verification — Submission Content

Use this content if Twilio asks for more detail during Toll-Free Verification review, or if the request bounces and needs resubmission. All values come from documented campaign facts only.

### Business / entity information

| Field | Value |
|---|---|
| Legal entity / business name | Matt Grant for Congress |
| Entity type | Federal political committee (candidate committee) |
| FEC committee ID | C00945394 |
| Use case category | Political / advocacy messaging |
| Business address | 1625 Mason Knoll Rd, St. Louis, MO 63131 |
| Contact email | mattgrantforcongress@gmail.com |
| Contact phone | (314) 255-7760 |
| Toll-free number | +1 844-314-7912 |

### Use-case description (paste into the form)

> Matt Grant for Congress is the authorized federal campaign committee (FEC ID C00945394) for Matt Grant, a candidate for the U.S. House of Representatives in Missouri's 2nd Congressional District (MO-02). We send campaign updates, event invitations, volunteer coordination, and fundraising messages to supporters who have opted in to receive text messages from the campaign. All messages identify the sender and include "Reply STOP to opt out." Message volume is low-to-moderate and tied to the 2026 election cycle.

### Opt-out / help language

> Recipients can opt out at any time by replying STOP; we honor opt-outs immediately and permanently suppress the number. Replying HELP returns campaign contact information.

---

## 2. Opt-In / Consent Description

Carriers and the TCPA both require that you can show *how* and *where* each recipient consented before you text them. Paste the relevant description into the verification form, and keep records of every opt-in source.

### Consent description (for the verification form)

> Supporters opt in to receive text messages from Matt Grant for Congress through one or more of the following: (1) submitting their mobile number on the campaign website with a checkbox/notice indicating they agree to receive campaign text messages; (2) texting a keyword to our number to subscribe; (3) providing their number on a paper or digital volunteer/supporter sign-up that includes SMS consent language; or (4) entering their number at a campaign event with posted consent notice. Consent is not a condition of any purchase or donation. Standard message and data rates may apply. Recipients can reply STOP to cancel and HELP for help.

### Web / paper opt-in notice (place next to any phone-number field)

> By providing your mobile number, you agree to receive recurring campaign text messages from Matt Grant for Congress. Msg & data rates may apply. Reply STOP to cancel, HELP for help. Consent is not a condition of donating.

**Recordkeeping:** For every opt-in, retain the date, the source (form URL, event, keyword), and the exact consent language shown. Keep donor and supporter contact lists secure — do not store SSNs, bank, or password data.

---

## 3. Compliant Message Templates

Each template includes the three required elements: **sender identification**, the **FEC disclaimer** (*Paid for by Matt Grant for Congress.*), and **STOP opt-out**. Replace bracketed placeholders before sending. Use a campaign-approved short link for the donate URL (full link: `https://secure.winred.com/matt-grant-for-congress/donate-today`). Do not add policy claims, poll numbers, or endorsements beyond documented facts.

> **First-message rule:** The initial message in any conversation must carry the full disclaimer and opt-out. In an active reply thread, repeating them every message is best practice but not always required.

### Fundraising

```
Matt Grant for Congress: Matt is running to represent MO-02. Grassroots
donations power this campaign -- can you chip in today? [donate link]
Paid for by Matt Grant for Congress. Reply STOP to opt out.
```

```
It's [FIRST NAME] from Team Matt Grant. We're closing in on our end-of-
month goal. A donation of any size makes a difference: [donate link]
Paid for by Matt Grant for Congress. Reply STOP to quit.
```

### Get Out The Vote (GOTV)

```
Matt Grant for Congress: The MO-02 primary is Aug 4, 2026. Make a plan to
vote! Find your polling place + hours: [link]. Paid for by Matt Grant for
Congress. Reply STOP to opt out.
```

```
Reminder from Matt Grant for Congress: TODAY is primary Election Day,
Aug 4. Polls close at [TIME]. Bring a friend! Paid for by Matt Grant for
Congress. Reply STOP to opt out.
```

### Event invitation

```
Matt Grant for Congress: Join Matt at [EVENT NAME] on [DATE] at [TIME],
[LOCATION]. RSVP here: [link]. Paid for by Matt Grant for Congress.
Reply STOP to opt out.
```

```
You're invited! Meet Matt Grant at [EVENT] this [DAY]. Details + RSVP:
[link]. Questions? Reply or call (314) 255-7760. Paid for by Matt Grant
for Congress. Reply STOP to quit.
```

### Volunteer ask

```
Matt Grant for Congress: We need volunteers for [ACTIVITY] on [DATE].
Can you join us? Sign up: [link]. Paid for by Matt Grant for Congress.
Reply STOP to opt out.
```

```
It's [FIRST NAME] with Team Matt Grant. Can you give 2 hours this weekend
to help us reach voters in MO-02? Reply YES or sign up: [link]. Paid for
by Matt Grant for Congress. Reply STOP to quit.
```

### HELP auto-reply

```
Matt Grant for Congress. For help, email mattgrantforcongress@gmail.com
or call (314) 255-7760. Reply STOP to unsubscribe. Msg & data rates may
apply.
```

---

## 4. Texting Compliance Checklist

Run through this before every campaign send. This combines federal telemarketing law (TCPA) with FEC disclaimer requirements.

```
[ ] Toll-free number shows Verified in Twilio (not Pending/In Review)
[ ] Every recipient has prior express consent on file (date + source)
[ ] Message includes sender identification (Matt Grant for Congress)
[ ] Message includes the FEC disclaimer: "Paid for by Matt Grant for Congress."
[ ] Message includes opt-out language ("Reply STOP to opt out")
[ ] Sending only between 8am and 9pm in the recipient's local time zone
[ ] STOP/UNSUBSCRIBE replies are honored immediately and suppressed permanently
[ ] HELP replies return campaign contact info
[ ] No prohibited content (no policy/poll/endorsement claims beyond documented facts)
[ ] Links go to campaign-controlled pages; donate link is the official WinRed URL
[ ] Opt-in records and contact lists stored securely (no SSN/bank/password data)
```

### Key rules at a glance

| Rule | Requirement |
|---|---|
| **Consent (TCPA)** | Obtain prior express consent before texting; political/autodialed texts to cell phones require it. Consent cannot be a condition of donating. |
| **Quiet hours (TCPA)** | Do not send before 8:00 a.m. or after 9:00 p.m. in the **recipient's** local time. |
| **Opt-out** | Honor STOP immediately and permanently. Provide a working HELP response. |
| **FEC disclaimer (52 USC 30120 / 11 CFR 110.11)** | "Paid for by Matt Grant for Congress." on the initial/standalone message. An abbreviated disclaimer that links to the full version is acceptable for very short texts. |
| **Carrier rules** | Toll-free number must be Verified; unverified sends fail with error 30032. Avoid prohibited/SHAFT content and link shorteners flagged by carriers. |

---

## 5. Website Opt-In Form Copy

Drop-in copy for an SMS sign-up form on the campaign website. The consent checkbox reuses the one-line opt-in notice from Section 2 — do not write a second version; keep the two identical so your displayed consent language matches what you record.

### Form layout

```
[ HEADING ]      Get text updates from Matt Grant for Congress

[ SUBHEAD ]      Be the first to hear about events, volunteer days, and
                 ways to help win MO-02.

[ FIELD ]        First name        [____________]
[ FIELD ]        Mobile number     [____________]

[ CHECKBOX ]     [ ] (use the Section 2 opt-in notice, verbatim)

[ BUTTON ]       Sign me up
```

### Microcopy

| Element | Copy |
|---|---|
| Checkbox helper (under the box) | Required to receive texts. You can reply STOP anytime. |
| Submit button | Sign me up |
| Success / confirmation state | Thanks! Watch for a text from Matt Grant for Congress to confirm. Reply YES to start receiving updates. |
| Error (no consent checked) | Please check the box to agree to receive campaign texts. |
| Error (invalid number) | Please enter a valid U.S. mobile number. |

**Implementation notes:** Keep the consent checkbox **unchecked by default** (no pre-ticked boxes). Capture and store the consent timestamp, the exact notice text shown, and the form URL with each submission (see Section 2 recordkeeping). Consent must not be a condition of donating, so do not place this checkbox inside the donation flow as a requirement.

---

## 6. Keyword Auto-Responder Sequence

A double opt-in keyword flow for the toll-free number. New subscribers text a keyword to join, confirm once, then receive a welcome. STOP and HELP behavior is defined in Sections 3-4 — wire those existing replies in rather than authoring new ones.

```mermaid
flowchart TD
    A[Person texts JOIN to the number] --> B[Send confirmation request]
    B --> C{Reply YES?}
    C -->|Yes| D[Mark consent + send Welcome message]
    C -->|No reply / other| E[Do not subscribe; no further texts]
    D --> F[Subscriber receives campaign updates]
    F --> G{Replies STOP?}
    G -->|Yes| H[Honor opt-out -- see Sections 3-4]
```

### Keyword definitions

| Keyword | Action | Auto-reply |
|---|---|---|
| `JOIN` (or `MATT`) | Start double opt-in | Confirmation request (below) |
| `YES` | Confirm subscription | Welcome message (below) |
| `HELP` | Return contact info | Use the HELP auto-reply in Section 3 |
| `STOP` | Unsubscribe | Honor immediately + permanent suppression (Section 4) |

### Confirmation request (sent after JOIN)

```
Matt Grant for Congress: Reply YES to confirm you want recurring campaign
texts. Msg & data rates may apply. Reply HELP for help, STOP to cancel.
Paid for by Matt Grant for Congress.
```

### Welcome message (sent after YES)

```
Welcome to Team Matt Grant! You'll get updates on events, volunteering,
and our campaign for MO-02. Get involved: [link]. Paid for by Matt Grant
for Congress. Reply STOP to opt out.
```

**Notes:** Only mark a number as consented after the explicit YES confirmation — texting JOIN alone is the request, not the consent of record. Log the keyword, the inbound timestamp, and the confirmation reply for your opt-in records.

---

## Cross-References

- `tools/disclaimer-generator.md` — Full "Paid for by" disclaimer rules across every medium, including SMS/MMS.
- `federal/digital-advertising.md` — FEC rules for digital and online political communications.
- `messaging/email-fundraising.md` — Companion channel; consent and disclaimer practices align.
- `messaging/social-media-strategy.md` — Platform messaging and compliance.

---

*This is educational information, not legal advice. TCPA rules, carrier requirements, and FEC guidance change and vary by situation. Verify current requirements with the FEC, the FCC, your carrier/Twilio, and a campaign finance or telecommunications attorney before sending. Last reviewed: 2026-06-28.*
