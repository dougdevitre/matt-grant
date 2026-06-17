# Ballot Chase Program: GOTV Operations Core

Ballot chasing is the systematic process of tracking which supporters have voted and contacting those who have not until they do. This is the single most important operational program in the final weeks of a campaign. Elections are decided by who actually votes, not who says they will.

---

## Program Overview

A ballot chase program has three phases:
1. **Early vote period:** Track and encourage early/absentee voting among supporters
2. **Absentee ballot chase:** Ensure every supporter who requested a mail ballot returns it
3. **Election Day chase:** Real-time voter check-off with same-day contact to non-voters

Every phase uses the same core loop: identify your universe, track who has voted, contact those who have not, repeat daily.

---

```mermaid
flowchart TD
    subgraph EV["Early Vote Period"]
        E1["Track Daily Who Voted"] --> E2["Contact Those Who Haven't"]
    end
    subgraph AB["Absentee Chase"]
        A1["Mail Reminder"] --> A2["Phone"] --> A3["Text"] --> A4["Door Knock"]
        A4 --> A5{"Ballot Rejected?"}
        A5 -->|Yes| A6["Ballot Cure"]
        A5 -->|No| DONE1["Voted"]
    end
    subgraph ED["Election Day"]
        ED1["Real-Time Check-Off"] --> W1["Wave 1: Morning\nTexts + calls to Tier 1"]
        W1 --> W2["Wave 2: Midday\nUpdate lists, text Tier 1+2"]
        W2 --> W3["Wave 3: Afternoon\nDoor knocks, rides to polls"]
        W3 --> W4["Wave 4: Closing Push\nAll-hands, final blast"]
        W4 --> PC["Polls Close"]
    end
    EV --> AB --> ED
```

## Universe Prioritization Tiers

Not every voter gets the same chase effort. Prioritize based on support level and vote propensity.

**Tier 1 -- Chase Hard (highest priority):**
- Identified supporters who are infrequent voters (support you but may not vote without a push)
- They get every round of contact: mail, phone, text, door knock
- This tier wins or loses your election

**Tier 2 -- Chase Firm:**
- Identified supporters who are moderate-propensity voters (usually vote but not always)
- They get phone, text, and one door knock if resources allow

**Tier 3 -- Chase Light:**
- Identified supporters who are high-propensity voters (will probably vote on their own)
- They get one text or phone reminder -- insurance, not heavy lifting

**Tier 4 -- Persuasion GOTV:**
- Lean supporters or soft undecideds who could break your way
- Persuasion-plus-GOTV message: "Here is why [Candidate] and here is how to vote"
- Only pursue if Tiers 1-3 are fully covered

**Do NOT chase:**
- Identified opponent supporters (you would be turning out their voters)
- Hard undecideds with no lean (resource intensive, uncertain return)

---

## Early Vote Tracking

### Obtaining Daily Early/Absentee Vote Data
1. Contact your county or state elections office to request daily early vote and absentee ballot files
2. Most states provide these files daily or several times per week during the early vote period
3. File formats vary: CSV, tab-delimited, or proprietary. Confirm format before the early vote period starts.
4. Assign a data manager to download, process, and match files every morning by 9 AM

### Daily Universe Updates
1. Match the early vote file against your supporter universe by voter ID or name/DOB
2. Mark voters who have already voted as "banked" -- remove them from all contact lists immediately
3. Generate a fresh "still outstanding" list: supporters who have not yet voted
4. Distribute updated contact lists to phone, text, and field teams by 10 AM daily
5. Update your daily chase report (see format below)

**Critical rule:** Contacting someone who has already voted wastes resources and annoys supporters. Update lists daily without exception.

### Early Vote Encouragement Timeline
- **3 weeks out:** Email, text, and social media encouraging early voting. General audience.
- **2 weeks out:** Targeted calls and texts to Tier 1 supporters with early vote locations, hours, and logistics
- **1 week out:** Door knocks to Tier 1 supporters who have not yet voted early
- **Final days of early vote:** All-hands push. "Can you vote today? [Location] is open until [time]."

**Script:**
"Hi [Name], this is [Volunteer] with [Candidate]'s campaign. Early voting is open right now. You can vote at [location], open [hours]. It takes about [time] and lines are short. Can we count on you to vote this week?"

---

## Absentee Ballot Chasing

### Identifying Outstanding Ballots
- Obtain the absentee ballot request file from the elections office
- Cross-reference with the absentee ballot return file (updated daily)
- Generate a list of supporters who requested a ballot but have not returned it
- This list is your absentee chase universe

### Contact Sequence for Outstanding Ballots

**Contact 1 -- Mail Reminder (7-10 days after ballot mailed):**
Postcard or letter: "We see you requested your ballot. Have you received it? Here is how to fill it out and return it. Deadline: [date]. Questions? Call [number]."

**Contact 2 -- Phone Call (3-5 days after Contact 1):**
"Hi [Name], this is [Volunteer] with [Candidate]'s campaign. We noticed you requested a mail ballot. Have you had a chance to fill it out and send it back? The deadline is [date]. You can also drop it off at [locations]."

**Contact 3 -- Text Message (3-5 days after Contact 2):**
"[Name] -- Reminder: your mail ballot is due [date]. Mail it now (allow 5 days) or drop off at [locations]. Need help? Reply here."

**Contact 4 -- Door Knock (7-10 days before Election Day):**
In-person visit. Offer to walk through the ballot, answer questions, remind of deadline and drop-off options. In states where legal, offer to collect and deliver the ballot (know your state's ballot collection laws).

**Contact 5 -- Final Call/Text (3 days before deadline):**
"[Name] -- Your ballot MUST be received by [date]. If you haven't mailed it, drop it off at [location] by [time]. Last chance to make your voice heard."

### Ballot Curing for Rejected Ballots
Some states allow voters to cure defective mail ballots (missing signature, signature mismatch, missing ID copy).

**Setup:**
1. Monitor the rejected/defective ballot list from elections office (available daily during cure period)
2. Cross-reference against your supporter list
3. Contact affected supporters within 24 hours -- cure deadlines are often only 2-5 days

**Cure script:**
"[Name], there is an issue with your mail ballot -- [specific issue]. You can fix this by [specific cure process] before [deadline]. We can help -- call [number] or visit [location]."

**This is the highest-ROI contact you will make.** Every cured ballot is a vote saved from the trash.

---

## Election Day Chase

### Real-Time Voter Check-Off at Polls
1. Station credentialed poll watchers at every precinct in your target universe
2. Watchers record names or voter ID numbers of every person who votes
3. Information relayed to the central boiler room every 30-60 minutes
4. Boiler room checks voters off the master list
5. Remaining list becomes the afternoon and evening chase target

**Technology options:**
- **Low-tech:** Watchers write names, runners bring lists to boiler room, staff checks off manually
- **Medium-tech:** Watchers text or call names to boiler room
- **High-tech:** Digital check-off app synced to voter file in real time

### Chase Waves: Deploying Volunteers Throughout the Day

**Morning wave (polls open - 11 AM):**
- Text all Tier 1 supporters: "Polls are open! Vote at [location], open until [time]. Need a ride? Call [number]."
- Phone calls begin to Tier 1 at 10 AM

**Midday wave (11 AM - 2 PM):**
- First check-off arrives. Remove voters who have voted.
- Text remaining Tier 1 and Tier 2
- Phone calls continue to remaining Tier 1

**Afternoon wave (2 PM - 5 PM):**
- Second check-off. Update lists.
- Door knocks to remaining Tier 1 who have not voted
- Phone and text to remaining Tier 2
- Deploy ride-to-polls volunteers

**Closing push (5 PM - polls close):**
- Final check-off. All-hands deployment.
- Every volunteer to doors of remaining Tier 1 and Tier 2
- Final text blast to all outstanding supporters
- Candidate makes personal calls to key supporters who have not voted
- All rides dispatched

### Ride-to-the-Polls
- Recruit volunteer drivers in advance (background checks recommended)
- Publish a "Need a ride?" phone number and text line
- Pre-identify voters who indicated transportation needs
- Station drivers near target precincts for rapid dispatch

---

## Daily Chase Report Format

Produce this report every morning during early vote and on election day:

```
============================================================
DAILY CHASE REPORT -- [DATE]
============================================================

OVERALL STATUS:
Total supporter universe:          [number]
Votes banked (to date):            [number] ([%] of universe)
Outstanding (not yet voted):       [number]
Daily vote goal:                   [number]
Actual votes today:                [number] (over/under by [number])

BY PRIORITY TIER:
                    Universe    Voted    Outstanding    % Complete
Tier 1:             [n]         [n]      [n]            [%]
Tier 2:             [n]         [n]      [n]            [%]
Tier 3:             [n]         [n]      [n]            [%]
Tier 4:             [n]         [n]      [n]            [%]

CONTACTS MADE TODAY:
Phone calls:        [n] attempted / [n] completed
Texts:              [n] sent / [n] responses
Door knocks:        [n]
Rides provided:     [n]

ABSENTEE BALLOT STATUS:
Ballots requested:  [n]
Ballots returned:   [n]
Ballots outstanding:[n]
Ballots rejected:   [n] (cures initiated: [n])

NOTES / ADJUSTMENTS:
[Observations, problems, tactical shifts for tomorrow]
============================================================
```

---

## Staffing Requirements

| Role | Responsibility |
|---|---|
| Chase Director | Oversees program, manages daily reports, makes tactical decisions |
| Data Manager | Processes voter files daily, generates contact lists, maintains check-off system |
| Phone/Text Lead | Manages phone and text bank volunteers |
| Field Lead | Manages door-to-door chase teams |
| Poll Watcher Coordinator | Recruits, trains, credentials, deploys poll watchers |
| Boiler Room Staff | Processes check-off data in real time on Election Day |
| Rides Coordinator | Manages drivers, dispatches rides |
| Legal Hotline | Election attorney for watcher issues, voter challenges, irregularities |

---

## Keys to Success

1. **Build your voter ID universe months before the chase.** You cannot chase voters you have not identified.
2. **Update lists daily.** Stale lists waste contacts.
3. **Remove voters who have voted immediately.** No exceptions.
4. **Escalate contact intensity as deadlines approach.** Start digital, end with doors.
5. **Test your systems before Election Day.** Run a dress rehearsal of check-off, communication, and data flow.
6. **Every vote banked early is one less to chase on Election Day.** Push early voting aggressively.
