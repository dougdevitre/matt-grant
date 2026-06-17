# Matt Grant for Congress

The official campaign, compliance, and strategy skill for **Matt Grant's run for the U.S. House of Representatives, Missouri — District 2 (MO-02)** in the **August 4, 2026 primary**, operated by the **Matt Grant for Congress Committee**.

> Matt Grant is a neighbor, a dad, and a problem-solver. He's spent his life bringing people together to get results, and he's running for Congress to put Missouri's children first. Matt does not just talk, he takes action.

## Campaign quick reference

| Field | Detail |
|---|---|
| **Candidate** | Matt Grant (Matthew Grant) |
| **Office** | U.S. House of Representatives, Missouri — District 2 (MO-02) |
| **Election** | Primary — August 4, 2026 |
| **Committee** | Matt Grant for Congress Committee |
| **Email** | mattgrantforcongress@gmail.com |
| **Phone** | (314) 255-7760 |
| **Address** | 701 Market Street, Suite 110, PMB 1709, St. Louis, MO 63101 |
| **Donate (WinRed)** | <https://secure.winred.com/matt-grant-for-congress/donate-today> |

Start here:

- [candidate/profile.md](candidate/profile.md) — Matt Grant's bio, career, values, and contact
- [candidate/platform.md](candidate/platform.md) — His four priorities and the CHILD Protection Act
- [candidate/strategic-plan.md](candidate/strategic-plan.md) — The strategic plan to win MO-02 on August 4, 2026

This skill is built on a general-purpose campaign toolkit ("get-elected") that retains full capability for any U.S. race — so the same engine that runs Matt's campaign can help anyone run a legally compliant, strategically sound campaign for public office, from school board to Congress.

## The web app — campaign site + campaign manager

The [`web/`](web/) folder is a Next.js app that turns this skill into a live product:

- **Public campaign website** — home, About Matt / Issues, Donate (WinRed), Press, and Contact, built from Matt's real positions with a modern "Ledger & Banner" identity and a live countdown to August 4.
- **Campaign manager** (`/dashboard`) — a staff "war room" with a fundraising thermometer, a donor ledger (FEC employer/occupation tracking + contribution-limit flags), a volunteer pipeline fed by the public contact form, a task board, a milestone timeline, and the strategic plan to win MO-02.

Stack: Next.js + Tailwind + Prisma/PostgreSQL + Clerk auth, deployable on Vercel. See [`web/README.md`](web/README.md) for setup and deploy steps. The dashboard's planning figures are illustrative placeholders, and its compliance helpers are educational, not legal advice.

## What This Skill Does

It is a comprehensive campaign assistant that provides guidance across every phase of running for office:

- **Campaign Finance Compliance** — Federal FEC rules and state-specific filing requirements, contribution limits, disclosure deadlines, and reporting obligations.
- **Campaign Strategy** — Race analysis, voter targeting, timeline planning, staffing structures, and budget frameworks tailored to the office you are seeking.
- **Messaging and Communications** — Platform development, stump speeches, debate preparation, press releases, op-eds, and issue framing.
- **GOTV (Get Out The Vote)** — Canvassing plans, phone bank scripts, poll watcher coordination, Election Day logistics, and early/absentee vote strategies.
- **Voter Engagement Tools** — 15 interactive tools for town halls, petition drives, voter registration events, community listening sessions, and more.

## How to Use It

Get Elected is a Claude AI skill. It triggers automatically when you ask campaign-related questions. You can also invoke any of its 80+ slash commands directly for instant artifact generation — everything from a fundraising plan to a compliance checklist to a volunteer onboarding packet.

Examples:

- "Summarize Matt Grant's platform for a one-pager."
- "What are the federal campaign finance rules for a U.S. House race in Missouri?"
- "Help me write a stump speech about putting Missouri's children first."
- "Build the field plan for the final 30 days before August 4, 2026."
- `/campaign-plan` — Generate a full campaign plan framework
- `/fundraising-strategy` — Build a fundraising strategy with timelines and targets
- `/compliance-checklist` — Produce a filing and compliance checklist for the race

## Directory Structure

```
matt-grant-for-congress/
├── candidate/           # Matt Grant — profile, platform, strategic plan
├── references/          # Core reference materials and legal foundations
├── federal/             # Federal election law, FEC rules, and compliance guides
├── states/              # State-specific election law and filing requirements
│   ├── AZ/
│   ├── CA/
│   ├── FL/
│   ├── GA/
│   ├── IL/
│   ├── MI/
│   ├── MO/              # Full coverage — complete state model
│   ├── NY/
│   ├── OH/
│   ├── PA/
│   └── TX/
├── workflows/           # Step-by-step campaign workflow guides
├── tools/               # Calculators, generators, and planning utilities
├── messaging/           # Speech templates, talking points, and comms frameworks
├── outreach/            # Voter contact, canvassing, and coalition-building
├── tactics/             # Field strategy, digital tactics, and GOTV operations
├── artifacts/           # Templates and generated document frameworks
├── commands.md          # Full catalog of 80+ slash commands
└── voter-engagement-tools.md  # 15 interactive voter engagement tools
```

## Coverage

Matt Grant's race is federal (U.S. House, MO-02), so it is governed by **FEC** rules plus **Missouri** ballot-access and state law — both fully covered here. The underlying toolkit also carries state-specific coverage for **11 states**, so it remains useful for any U.S. campaign:

| State | Abbreviation | Coverage Level |
|-------|--------------|----------------|
| Arizona | AZ | Core coverage |
| California | CA | Core coverage |
| Florida | FL | Core coverage |
| Georgia | GA | Core coverage |
| Illinois | IL | Core coverage |
| Michigan | MI | Core coverage |
| Missouri | MO | **Full coverage** |
| New York | NY | Core coverage |
| Ohio | OH | Core coverage |
| Pennsylvania | PA | Core coverage |
| Texas | TX | Core coverage |

Missouri serves as the complete state model with exhaustive coverage of every office level, filing deadline, contribution limit, and compliance requirement. Other states include core coverage sufficient to guide candidates through the major requirements of running for office.

Federal election law and FEC compliance guidance apply to all 50 states.

## Slash Commands

Over **80 slash commands** provide instant artifact generation for every aspect of a campaign. Commands span categories including:

- Campaign planning and launch
- Finance and fundraising
- Legal compliance and filing
- Messaging and communications
- Field operations and GOTV
- Digital strategy and social media
- Volunteer management
- Opposition research frameworks

Run any command by name to generate a ready-to-use document, checklist, or plan.

## Voter Engagement Tools

**15 interactive tools** help candidates build genuine connections with voters:

- Town hall planning and facilitation guides
- Voter registration drive toolkits
- Community listening session frameworks
- Petition and ballot initiative support
- Neighborhood canvassing systems
- Phone and text banking scripts
- Coalition-building workshops
- And more

## Guardrails

Get Elected operates under strict guardrails to ensure responsible use:

- **Nonpartisan tooling** — The underlying skill is a neutral campaign toolkit that serves candidates of any party or no party. It documents Matt Grant's own stated positions faithfully but does not editorialize, and it does not advocate any ideology beyond the candidate's published platform.
- **No Invented Law** — All legal and compliance information is grounded in referenced source material. The skill will never fabricate statutes, regulations, or filing requirements. It will not invent endorsements, polling data, or claims beyond the candidate's documented positions.
- **Educational Only** — This skill provides educational information to help citizens participate in democracy. It is not a substitute for professional legal, financial, or strategic counsel.
- **No Dark Arts** — This skill will not assist with voter suppression, disinformation, illegal coordination, fabricated endorsements, or any other unethical campaign practice.

## Contributing

Contributions are welcome. Areas where help is especially valuable:

- Adding or expanding state-specific coverage beyond the current 11 states
- Updating legal references to reflect new legislation or rule changes
- Improving templates and artifact quality
- Adding new slash commands for underserved campaign needs
- Testing workflows against real-world campaign scenarios

Please open an issue or submit a pull request. All contributions must maintain the nonpartisan, educational character of the project.

## Disclaimer

Get Elected provides **educational information only** and does **not** constitute legal advice. Campaign finance law, election law, and filing requirements vary by jurisdiction and change frequently. Always consult a qualified attorney, your state or local election authority, or the Federal Election Commission for authoritative guidance specific to your race and jurisdiction. Use of this skill does not create an attorney-client relationship or any other professional advisory relationship.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
