# GitHub Repository Metadata

Copy-paste these values into the GitHub repo settings for the Matt Grant for Congress campaign skill repo.

---

## Repository Settings

**Repository name:** `matt-grant-for-congress`

**Description (max 350 chars):**
```
Campaign, compliance, and strategy skill for Matt Grant's run for U.S. House, Missouri District 2 (MO-02) — primary August 4, 2026. Matt Grant for Congress. Includes his profile, platform, and strategic plan, built on a nonpartisan get-elected toolkit (FEC + Missouri coverage, 96 commands).
```

**Website:** `https://secure.winred.com/matt-grant-for-congress/donate-today`

**Topics (tags):**
```
matt-grant
mo-02
missouri
congress
campaign
elections
campaign-finance
political-campaign
get-out-the-vote
claude-skill
fec
fundraising
gotv
candidate
compliance
2026-primary
```

**Visibility:** Public

**License:** MIT

---

## Social Preview (Open Graph)

For the social preview image (displayed when the repo is shared on social media, Slack, etc.), create or upload a 1280×640 image with:

```
MATT GRANT FOR CONGRESS
━━━━━━━━━━━━━━━━━━━━━━━━━

U.S. House · Missouri District 2 (MO-02)
Primary — August 4, 2026

A neighbor. A dad. A problem-solver.
Putting Missouri's children first.

mattgrantforcongress@gmail.com
Donate: secure.winred.com/matt-grant-for-congress/donate-today
```

**Colors:** Use the campaign palette — clean, readable, high-contrast. Keep imagery focused on the candidate and the MO-02 message.

**Required disclaimer:** Any public-facing graphic or paid communication must carry the committee's "Paid for by" disclaimer. Use `tools/disclaimer-generator.md` to generate the correct text for the Matt Grant for Congress.

---

## Repository Features to Enable

- [x] Issues (for state requests, error reports, feature requests)
- [x] Discussions (for community Q&A, strategy conversations)
- [x] Wiki (optional — could mirror the reference files)
- [ ] Projects (optional — could track state expansion progress)
- [x] Sponsor button (links to FUNDING.yml)
- [ ] GitHub Pages (optional — could host a searchable documentation site)

---

## Releases

### v1.0.0 — Initial Release

**Tag:** `v1.0.0`
**Title:** `Matt Grant for Congress v1.0.0 — Campaign Skill`

**Release notes:**
```markdown
## Matt Grant for Congress v1.0.0

The first release of the Matt Grant for Congress campaign skill — Matt's run for
U.S. House, Missouri District 2 (MO-02), primary August 4, 2026.

### What's Included

- **Candidate files** — `candidate/profile.md`, `candidate/platform.md` (four
  priorities + the CHILD Protection Act), and `candidate/strategic-plan.md`
- A general-purpose, nonpartisan campaign toolkit beneath it:

- **SKILL.md router** — Routes by jurisdiction → role → phase → module (257 lines)
- **96 slash commands** — Instant artifact generation from `/launch` to `/victoryspeech`
- **11 states covered** — MO (full), IL, CA, TX, FL, NY, OH, PA, GA, AZ, MI
- **Federal compliance** — Verified 2025-2026 FEC limits, reporting, prohibited sources
- **16 workflows** — First 30 days through post-election wind-down
- **7 tools** — Contribution/expenditure trackers, limit checker, disclaimer generator, tech stack, voter engagement tools (15 interactive tools)
- **8 messaging modules** — Positioning through podcast campaigns
- **13 tactical modules** — Low-cost tactics, crisis management, surrogates, ballot chase, voter personas, election protection
- **2 outreach modules** — Stakeholder correspondence (14 templates) + endorsement playbook
- **1 artifact catalog** — 50+ document types with generation rules
- **1 command reference** — 96 instant-generation commands

### Key Features

- **Issue Response Engine** — Paste any issue → get 8 response formats (door, forum, statement, social, empathy-first, surrogate points, inoculation, bridge phrases)
- **Influence Network Targeting** — `/powermap` identifies high-profile advocates across 12 categories with scoring and outreach packages
- **Voter Engagement Tools** — 15 tools voters actually use: voting plan builder, issue quiz, endorsement card generator, relational outreach kit, pledge cards
- **Podcast Campaign** — Guest pitching, interview prep, launch planning, promotion packages with hashtags
- **$5,000 Campaign Plan** — Complete budget allocation for low-budget races ranked by cost-per-vote

### Compliance

- Every limit verified from FEC and state agency sources (January 2025 publications)
- Educational framing only — not legal advice
- Search-first for compliance — skill instructs Claude to verify current rules
- Nonpartisan — serves any candidate regardless of party

### Installation

This is a Claude skill. To use it:
1. Download/clone the repository
2. Add as a skill in Claude (claude.ai or Claude Code)
3. The SKILL.md router handles everything — just start talking about your campaign

### What's Next (Contributions Welcome)

- State expansion (39 states remaining — see `states/_state-index.md`)
- GitHub Pages documentation site
- Localized templates for specific office types
- Integration with campaign finance APIs
```

---

## Branch Protection (Recommended)

For the `main` branch:
- [x] Require pull request reviews before merging
- [x] Require status checks to pass (if CI is added later)
- [ ] Require signed commits (optional)
- [x] Do not allow force pushes

---

## Labels

Create these custom labels for issue tracking:

| Label | Color | Description |
|---|---|---|
| `state-expansion` | `#0E8A16` (green) | Adding coverage for a new state |
| `compliance-error` | `#D93F0B` (red) | Incorrect legal or compliance information |
| `enhancement` | `#A2EEEF` (light blue) | New feature or module |
| `good first issue` | `#7057FF` (purple) | Good for newcomers |
| `verification-needed` | `#FBCA04` (yellow) | Data needs to be verified against current sources |
| `federal` | `#1D76DB` (blue) | Related to federal campaign finance |
| `state-specific` | `#0075CA` (medium blue) | Related to a specific state's rules |
| `messaging` | `#D876E3` (pink) | Related to messaging, content, or communications |
| `tactics` | `#F9D0C4` (peach) | Related to campaign tactics and strategy |
| `voter-tools` | `#C5DEF5` (light blue) | Related to voter-facing engagement tools |

---

## Git Commands to Initialize and Push

```bash
cd matt-grant-for-congress

# Initialize
git init
git add .
git commit -m "v1.0.0: Matt Grant for Congress campaign skill (MO-02, Aug 4 2026)

Initial release of the Matt Grant for Congress campaign skill — Matt's run for
U.S. House, Missouri District 2 (MO-02), primary August 4, 2026, operated by the
Matt Grant for Congress.

Includes the candidate/ files (profile, platform, strategic plan) on top of a
nonpartisan get-elected toolkit covering FEC + Missouri compliance, fundraising,
messaging, field, and GOTV.

See README.md for full documentation."

# Set up remote
git branch -M main
git remote add origin git@github.com:dougdevitre/matt-grant-for-congress.git

# Push
git push -u origin main

# Tag the release
git tag -a v1.0.0 -m "v1.0.0: Matt Grant for Congress campaign skill (MO-02, Aug 4 2026)"
git push origin v1.0.0
```

---

## GitHub Pages (Optional — Future Enhancement)

If you want to publish a documentation site:

```bash
# From the repo root
# Option 1: Use the existing markdown files with Jekyll
# Enable GitHub Pages in repo settings → Source: main branch → /docs folder

# Option 2: Build a searchable site
# Could use Docusaurus, MkDocs, or a custom React site
# that makes the 80 files browsable and searchable
```

---

## README Badges

Add these to the top of README.md:

```markdown
![Office](https://img.shields.io/badge/office-U.S.%20House%20MO--02-blue)
![Primary](https://img.shields.io/badge/primary-Aug%204%2C%202026-green)
![Committee](https://img.shields.io/badge/committee-Matt%20Grant%20for%20Congress-orange)
![Donate](https://img.shields.io/badge/donate-WinRed-red)
```
