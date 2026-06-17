# Voter Engagement Tools — Reference Index

This file provides a summary reference to the main voter engagement tools documented in `/voter-engagement-tools.md` at the repository root. It exists to ensure the `tools/` directory has complete coverage of all tool categories referenced in SKILL.md.

For full documentation, see the primary file: **`/voter-engagement-tools.md`**

---

## Tool Summary

The voter engagement toolkit contains 15 tools organized across the full voter contact lifecycle: identification, persuasion, mobilization, and turnout.

### 1. Voter File Analysis
Parse and segment the voter file by party, vote history, geography, demographics, and custom scores. Foundation for all targeting decisions.

### 2. Canvassing / Door-Knocking
Door-to-door voter contact scripts, walk sheet generation, turf cutting (geographic assignment), data capture forms, and volunteer management for canvass operations.

### 3. Phone Banking
Call scripts, predictive dialer setup, volunteer phone bank management, call disposition tracking, and phone ID programs for voter identification.

### 4. Peer-to-Peer Texting
Script templates, opt-in/opt-out compliance (TCPA), platform setup guides, conversation flows, and volunteer training for P2P text campaigns.

### 5. Broadcast / Bulk SMS
Mass text message templates for announcements, GOTV reminders, event invitations, and fundraising appeals. Compliance requirements and frequency guidelines.

### 6. Direct Mail Targeting
Mail universe selection, mail piece types (persuasion, contrast, GOTV), production timelines, postal requirements, and response tracking.

### 7. Yard Sign Strategy
Sign placement strategy, volunteer distribution systems, sign request tracking, legal placement rules, and sign theft/damage response.

### 8. Community Event Planning
Town halls, meet-and-greets, house parties, rallies, and community forums. Event logistics checklists, volunteer roles, and follow-up processes.

### 9. Voter Registration Drives
Registration drive planning, location selection, legal requirements by state, form handling, volunteer training, and deadline tracking.

### 10. Endorsement Solicitation
Endorsement request letters, tracking spreadsheets, announcement coordination, endorsement card/flyer templates, and follow-up sequences.

### 11. Coalition Building
Identify aligned organizations, outreach strategies, coalition event co-sponsorship, shared messaging development, and mutual support agreements.

### 12. Absentee / Vote-by-Mail Programs
Absentee ballot request assistance, chase programs (tracking who has returned ballots), reminder sequences, and cure notice follow-up.

### 13. Early Vote Mobilization
Early voting location promotion, early vote tracking, knock/call/text schedules tied to early voting windows, and daily early vote monitoring.

### 14. Election Day GOTV
Get-Out-The-Vote operations: poll watching, ride-to-polls, last-round contacts, voter check-off systems, and real-time turnout tracking.

### 15. Post-Election Follow-Up
Thank-you communications, results analysis, volunteer appreciation, donor stewardship, transition planning (if elected), and future campaign groundwork.

---

## Cross-Reference Table

| Tool | Primary Use Phase | Key Integrations |
|---|---|---|
| Voter File Analysis | Planning | All other tools |
| Canvassing | Persuasion + GOTV | Voter file, phone banking |
| Phone Banking | ID + Persuasion + GOTV | Voter file, canvassing |
| P2P Texting | Persuasion + GOTV | Voter file, phone banking |
| Bulk SMS | Mobilization | Email, events |
| Direct Mail | Persuasion | Voter file, fundraising |
| Yard Signs | Visibility | Events, volunteers |
| Community Events | Persuasion + Fundraising | Email, social media |
| Voter Registration | Expansion | Voter file, canvassing |
| Endorsements | Credibility | Press, social media, mail |
| Coalition Building | Expansion + Persuasion | Events, endorsements |
| Absentee/VBM | Turnout | Voter file, texting, mail |
| Early Vote | Turnout | Voter file, texting, phone |
| Election Day GOTV | Turnout | All contact tools |
| Post-Election | Stewardship | Email, events |

---

## Usage Notes

- Each tool in the main file includes actionable templates, scripts, checklists, and data schemas.
- Tools are designed to work together — canvassing data feeds phone banking targets, which feed texting lists, which feed GOTV universes.
- The voter file is the foundation. Start there before deploying any other tool.
- For campaign technology platforms that support these tools, see `tools/campaign-tech-stack.md`.
- For compliance requirements related to voter contact (disclaimers, do-not-call lists, texting consent), see `tools/disclaimer-generator.md` and the relevant federal/state reference files.
