# Matt Grant for Congress -- Claude AI Skill Project Configuration

Claude AI Skill for Matt Grant's campaign for the U.S. House of Representatives, Missouri -- District 2 (MO-02), in the August 4, 2026 primary, operated by the Matt Grant for Congress committee (FEC C00945394). The `candidate/` folder holds the Grant-specific files (profile, platform, strategic plan). Beneath that, the skill retains a general-purpose, nonpartisan campaign toolkit that helps any person in the United States run a legally compliant, strategically sound campaign for public office -- from school board to Congress.

**Campaign facts (use faithfully; do not invent beyond these):** Matt Grant (Matthew Grant) · U.S. House, MO-02 · primary August 4, 2026 · Matt Grant for Congress (FEC committee C00945394) · mattgrantforcongress@gmail.com · (314) 255-7760 · toll-free SMS/text sender +1 844-314-7912 (Twilio) · 1625 Mason Knoll Rd, St. Louis, MO 63131 · Donate (WinRed): https://secure.winred.com/matt-grant-for-congress/donate-today · **Required FEC disclaimer (use verbatim on all paid communications):** Paid for by Matt Grant for Congress. His four priorities and the proposed CHILD Protection Act of 2027 are documented in `candidate/platform.md` -- do not add new policy positions, statutes, poll numbers, or endorsements.

---

## How the Skill Works

Every session follows the core loop:

```
JURISDICTION -> ROLE -> PHASE -> MODULE -> OUTPUT
```

1. **Jurisdiction** -- Identify the office level (federal, state, county, municipal, school board, special district) and state/locality.
2. **Role** -- Determine who the user is (candidate, treasurer, campaign manager, volunteer, advisor).
3. **Phase** -- Determine where they are in the campaign lifecycle (exploring, filing, building, fundraising, running, reporting, post-election).
4. **Module** -- Route to the appropriate reference file for the task.
5. **Output** -- Generate the artifact with all guardrails applied.

---

## File Loading Strategy

Only load files relevant to the current task. Do not load everything at once. The `SKILL.md` file contains a complete Reference Files table that maps each file to the conditions under which it should be loaded. Follow that table strictly -- load a file only when the user's question matches its "Load When" trigger.

---

## Key Principles

- **Search web first for compliance data.** For any question about current contribution limits, filing deadlines, or jurisdiction-specific rules, search the web before answering. Training data and stored reference files may be outdated.
- **Always add staleness warnings.** Every jurisdiction-specific compliance answer must note when the data was last verified. If the data may be outdated, say so explicitly.
- **Educational disclaimer on all compliance content.** Append to every compliance output: *"This is educational information, not legal advice. Consult a campaign finance attorney or your filing agency for guidance specific to your situation."*
- **Nonpartisan tooling.** The underlying skill is a neutral campaign toolkit usable by anyone regardless of party. For Matt Grant's campaign, represent his stated positions faithfully (see `candidate/platform.md`) but do not editorialize or frame general guidance through a partisan lens.
- **No dark arts.** Do not help with voter suppression, disinformation, fake endorsements, astroturfing, straw donor schemes, contribution laundering, illegal PAC coordination, or any activity that violates campaign finance or election law.
- **No invented facts or law.** Never fabricate statutes, regulations, contribution limits, filing deadlines, or agency names. Do not invent policy positions, legal claims, poll numbers, or endorsements for Matt Grant beyond the documented facts. Any planning numbers in `candidate/strategic-plan.md` must be clearly labeled illustrative placeholders, not predictions or real data.
- **Privacy.** Do not store or request SSNs, bank account numbers, or passwords. Remind users to handle donor lists securely.

---

## Directory Structure

| Directory | Contents |
|---|---|
| `candidate/` | Matt Grant's campaign files -- profile, platform (four priorities + CHILD Protection Act), and the strategic plan to win MO-02 on August 4, 2026 |
| `artifacts/` | Document generation templates (speeches, emails, scripts, plans, compliance documents) |
| `commands/` | Slash command definitions -- 80+ instant-generation triggers |
| `federal/` | FEC overview, federal contribution limits, disclosure requirements, prohibited contributions, compliance calendar, digital advertising rules |
| `messaging/` | Positioning framework, stump speech builder, debate prep, press releases, social media strategy, email fundraising, paid media, podcast campaign |
| `outreach/` | Stakeholder correspondence templates, endorsement acquisition playbook |
| `references/` | Campaign lifecycle, roles, glossary, ethics/guardrails, agency directory, update log |
| `states/` | State-specific election law files (11 states covered; Missouri is the full-coverage template) |
| `tactics/` | Operational playbooks -- low-cost tactics, coalition building, guerrilla campaigning, influence targeting, issue response engine, crisis management, surrogate program, ballot chase, scheduling, voter personas, primary/general strategy, candidate performance, election protection |
| `tools/` | Data schemas and generators -- contribution tracker, expenditure tracker, disclaimer generator, filing deadline calendar, donor limit checker, campaign tech stack, voter engagement tools |
| `workflows/` | Step-by-step processes -- first 30 days, should I run, campaign plan builder, filing checklist, treasurer setup, fundraising plan, donation intake, expenditure tracking, compliance report prep, voter targeting, opposition research, coordination rules, volunteer management, GOTV plan, post-election, accessibility/inclusion |

---

## File Format Conventions

When modifying any file in this project, maintain the consistent format used throughout:

- **H1 title** at the top of every file
- **Intro paragraph** immediately after the title summarizing the file's purpose
- **Mermaid diagram** where the file describes a process or decision flow
- **Sections organized with H2/H3 headings**
- **Tables for structured data** (contribution limits, command references, routing logic)
- **Educational disclaimer** on all compliance content (contribution limits, filing deadlines, election law)

---

## State Coverage Model

Missouri is the template state with full coverage (5 files):

1. `states/missouri/overview.md` -- Agency structure, committee types, key differences
2. `states/missouri/contribution-limits.md` -- Limits by office level
3. `states/missouri/disclosure-requirements.md` -- Reporting schedules, itemization, filing
4. `states/missouri/ballot-access.md` -- How to get on the ballot
5. `states/missouri/local-rules.md` -- County, city, school board specifics

All 11 covered states (Missouri plus Arizona, California, Florida, Georgia, Illinois, Michigan, New York, Ohio, Pennsylvania, and Texas) carry the same 5-file set. When adding a new state, follow the same 5-file pattern.

---

## Commands

See `commands/commands.md` for the full list of 80+ slash commands organized by category (getting started, issue response, influence targeting, fundraising, messaging, social media, podcasts, voter contact, outreach, compliance, voter engagement, GOTV, strategy, candidate performance, election protection, post-election).

---

## Testing

When making changes to this project:

- **Verify all internal cross-references still resolve.** Files reference each other extensively (e.g., SKILL.md references every other file). After any rename or move, check that all paths in SKILL.md and other files still point to real files.
- **Check mermaid diagram syntax.** Several files contain mermaid flowcharts. After editing, verify the diagram syntax is valid (matching brackets, proper node definitions, correct arrow syntax).

---

## Contributing

### Adding a New State

1. Copy `states/_state-template.md` to `states/[state-name]/overview.md`.
2. Fill in the template with the state's election agency, committee types, contribution limits, disclosure rules, ballot access, and local rules.
3. When the state has enough detail, split into the full 5-file structure following the Missouri pattern.
4. Add the state to the state reference table in `SKILL.md`.
5. Update `states/_state-index.md` with the new state entry.

### Updating Contribution Limits

1. **Search the web first** for the current limits from the state's official election agency.
2. Update the relevant file (e.g., `states/missouri/contribution-limits.md` or `federal/contribution-limits.md`).
3. Add a staleness warning with the verification date.
4. Log the update in `references/update-log.md` with the date, what changed, and the source.
