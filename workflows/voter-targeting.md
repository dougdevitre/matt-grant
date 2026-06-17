# Voter Targeting

A guide to identifying, segmenting, and prioritizing the voters your campaign needs to contact. Targeting is the science of focusing your limited resources -- time, money, volunteers -- on the voters most likely to determine the outcome. A campaign that talks to everyone talks to no one effectively.

---

## Voter File Basics

The voter file is your campaign's most important data asset. It contains records for every registered voter in your jurisdiction.

### What the Voter File Contains
- Voter name, address, date of birth, gender
- Party registration (in states with party registration)
- Vote history (which elections the voter participated in, NOT how they voted)
- District and precinct assignments
- Registration date
- Phone number and email (sometimes, depending on the state)

### How to Obtain the Voter File
- [ ] State party committees (Democratic or Republican) often provide enhanced voter files to candidates through platforms like VAN/VoteBuilder or PDI
- [ ] Secretaries of state or county election offices sell the raw voter file (usually for a fee)
- [ ] Commercial vendors (L2, TargetSmart, Aristotle) offer enhanced files with consumer data appended
- [ ] Determine which option is available, affordable, and most useful for your race
- [ ] Load the voter file into your CRM or voter contact platform

### Data Hygiene
- [ ] Verify the file is current (when was it last updated?)
- [ ] Remove deceased voters and voters who have moved out of the district
- [ ] Standardize addresses for mail and turf-cutting purposes
- [ ] Append phone numbers and emails if not included (commercial append services)

---

## Targeting Methodology

### The Three Universes

```mermaid
flowchart TD
    A["Total Registered Voters"] --> B["Base Voters"]
    A --> C["Persuadable Voters"]
    A --> D["Opposition Voters"]

    B --> B1["Will vote for you"]
    B1 --> B2["Strategy: Mobilize"]
    B2 --> B3["GOTV contacts, early vote chase, reminders"]

    C --> C1["Could go either way"]
    C1 --> C2["Strategy: Persuade"]
    C2 --> C3["Message-heavy contacts, mail, digital ads"]

    D --> D1["Won't vote for you"]
    D1 --> D2["Strategy: Ignore"]
    D2 --> D3["Do not spend resources"]
```

Every voter in your district falls into one of these categories. Your job is to classify them and allocate resources accordingly.

#### 1. Base Voters (Mobilization Targets)
Voters who will support you if they show up, but may not show up without encouragement.

- Same party registration as you
- Inconsistent vote history (voted in some elections, skipped others)
- Strategy: Motivate them to vote. GOTV contacts, early vote chase, reminders.

#### 2. Persuadable Voters (Persuasion Targets)
Voters who will show up but have not decided who to vote for.

- Independent or unaffiliated registration
- Cross-party voters (registered one party but sometimes vote for the other)
- Consistent vote history (they show up regularly)
- Strategy: Convince them to vote for you. Message-heavy contacts, mail, digital ads.

#### 3. Unlikely Supporters (Low Priority)
Voters who are very unlikely to support you regardless of contact.

- Opposite party registration with consistent opposite-party vote history
- Strategy: Do not spend resources on them. They are not your audience.

### Building Your Target Universe

- [ ] Start with your win number (see `campaign-plan-builder.md`)
- [ ] Estimate your base vote (reliable supporters who will vote without contact)
- [ ] Calculate the gap: win number minus base vote = votes you need to earn
- [ ] Build a persuasion universe of voters who can fill that gap
- [ ] Build a mobilization universe of low-propensity supporters
- [ ] Total contact universe = persuasion universe + mobilization universe
- [ ] Size your contact universe at 2-3x the gap (not everyone you contact will be persuaded or mobilized)

---

## Voter Scoring and Modeling

### Vote Propensity Score
Rate each voter on their likelihood of voting (based on vote history):

| Elections Voted (out of last 4 comparable) | Propensity Score |
|---|---|
| 4 of 4 | 4 (Always votes) |
| 3 of 4 | 3 (Usually votes) |
| 2 of 4 | 2 (Sometimes votes) |
| 1 of 4 | 1 (Rarely votes) |
| 0 of 4 | 0 (Never votes -- may not be worth contacting) |

### Support Score
Rate each voter on their likelihood of supporting you:

- **Party registration** (strongest predictor in partisan races)
- **Primary vote history** (which party's primary do they vote in?)
- **Precinct performance** (voters in precincts that lean your way are more likely supporters)
- **Survey or canvass data** (direct voter contact is the gold standard)
- **Modeling** (if available -- commercial models predict support based on demographics and consumer data)

### Targeting Matrix

| | High Support Likelihood | Medium Support | Low Support |
|---|---|---|---|
| **High Propensity (3-4)** | Base: light GOTV touch | Persuasion: top priority | Do not contact |
| **Medium Propensity (2)** | Mobilization: GOTV focus | Persuasion + GOTV | Do not contact |
| **Low Propensity (0-1)** | Mobilize only if resources allow | Low priority | Do not contact |

---

## Canvass Universe and Turf Cutting

### Building the Canvass Universe

- [ ] Apply your targeting criteria to the voter file to generate your canvass list
- [ ] Prioritize by the targeting matrix above
- [ ] Estimate the total number of doors (households, not individual voters)
- [ ] Calculate the number of canvass shifts needed (a volunteer can knock 40-60 doors in a 3-hour shift)
- [ ] Determine your canvass schedule (days per week, weeks of canvassing)

### Turf Cutting

Turf cutting is dividing your canvass universe into walkable geographic areas for each shift.

- [ ] Use mapping software (MiniVAN, Organizer, or GIS tools) to create turf packets
- [ ] Each turf should contain 40-60 targeted doors for a 3-hour shift
- [ ] Keep turfs geographically compact to minimize walking time
- [ ] Include a map with each turf packet
- [ ] Number or name each turf for tracking purposes
- [ ] Prioritize turfs in high-value precincts first

### Walk Lists

A walk list is the printed or digital list a canvasser carries door-to-door.

- [ ] Include: voter name, address, party registration, vote history summary, any prior contact notes
- [ ] Sort by street address for efficient walking order
- [ ] Include a field for the canvasser to record the result (support level, not home, refused, etc.)
- [ ] Train canvassers on how to read and complete the walk list
- [ ] Collect completed walk lists after every shift and enter data promptly

---

## Phone Universe

Phone outreach complements door knocking and reaches voters you cannot visit in person.

- [ ] Build a phone universe from your target list (voters with phone numbers on file)
- [ ] Prioritize persuadable voters and mobilization targets
- [ ] Use a phone banking platform (ThruTalk, LiveVox, or your CRM's built-in dialer)
- [ ] Prepare a phone script with ID questions and message delivery
- [ ] Track results: support level, callback needed, wrong number, no answer
- [ ] Plan phone bank shifts (a caller can reach 15-25 voters per hour)
- [ ] Schedule phone banks for evenings (5-8 PM) and weekends for highest contact rates

---

## Digital Targeting

Online advertising allows precise targeting that complements your field program.

- [ ] Upload your voter file or target list to digital platforms for matched audience targeting
- [ ] Target persuadable voters with message-focused ads
- [ ] Target base voters with mobilization and GOTV messaging
- [ ] Use geographic targeting to focus on key precincts
- [ ] Use interest and demographic targeting as a supplement (not a replacement) for voter file targeting
- [ ] Retarget website visitors and email openers for reinforcement
- [ ] Track digital metrics (impressions, clicks, conversions) and correlate with voter contact data

---

## Data Collection and Feedback Loop

Targeting improves as you collect data from voter contacts.

- [ ] After every canvass shift, enter voter contact results into the CRM
- [ ] Update support scores based on direct voter contact
- [ ] Adjust your universes as you learn who supports you and who does not
- [ ] Drop confirmed opponents from your contact list (do not waste resources)
- [ ] Move confirmed supporters to your GOTV universe
- [ ] Move persuadable voters who express interest to a follow-up contact plan
- [ ] Review targeting data weekly and adjust resource allocation

---

## Key Principles

1. **Be disciplined.** Only contact voters in your target universe. Every minute spent on a non-target voter is a minute not spent on someone who could determine the outcome.
2. **Repetition matters.** Voters need 5-7 contacts across multiple channels before a message sticks. Plan for repeated contact with your persuasion universe.
3. **Data is perishable.** Voter attitudes change. Keep collecting data and updating your models throughout the campaign.
4. **Targeting is not optional.** Even in small races, the difference between a targeted and untargeted campaign is often the difference between winning and losing.
