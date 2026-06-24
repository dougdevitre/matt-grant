<div align="center">

# Matt Grant for Congress
### Missouri's 2nd District · Primary Election Day — August 4, 2026

**A neighbor, a dad, and a problem-solver — running to put Missouri's children first.**

[**Donate**](https://secure.winred.com/matt-grant-for-congress/donate-today) ·
[**Meet Matt & the Issues**](candidate/platform.md) ·
[**The Plan to Win**](candidate/strategic-plan.md)

</div>

---

## Missouri families deserve someone who shows up — and gets results.

Dear neighbor,

You already know the feeling. The campaign signs change, the speeches sound the same, and yet the
basics families count on never seem to get fixed. After **more than a decade** of the same approach,
too many Missouri kids are still waiting on a fair shot.

**Matt Grant is running to change that — and he doesn't just talk, he takes action.**

Matt is a neighbor and a dad. He went to three public schools, earned the rank of **Eagle Scout**,
and built a 23-year legal career bringing people together to win hard fights for Missouri's families
and businesses. He's not a career politician chasing a seat. He's a problem-solver running to fix
something specific — and to put **children first**.

This isn't about tearing anyone down. It's about a higher standard. Here's the standard Matt is
willing to be held to:

| What Missouri deserves | What Matt commits to |
|---|---|
| Service, not careerism | **Term limits for the House and Senate — including his own.** |
| A representative you can actually reach | **Open town halls in every county. You shouldn't need a fundraiser invitation to reach your member of Congress.** |
| Results, not press releases | **23 years winning by building coalitions across the aisle.** |
| Someone fighting for *your* kids | **The CHILD Protection Act — cleaning up the family-court system no one else is willing to touch.** |

Read those again. Every one is a promise Matt will keep — and a contrast you can feel without anyone
having to name names. Fresh energy isn't a slogan. It's a willingness to limit your own power, show
up where it's hard, and fight for the people who don't have a lobbyist.

**That's the choice on August 4.**

---

## The platform — four fights worth winning

1. **End corruption in the family court system.** Children are too often caught in a system that
   protects insiders instead of kids. Matt champions the **CHILD Protection Act** — *Corruption
   Hiding Inside Legal Dockets* — and federal oversight that ties Title IV-D grant money to states
   that keep their family courts clean.
2. **Term limits for the House and Senate** — with a grandfather clause so reform actually passes.
   Public service was never meant to be a lifelong career.
3. **A smaller, leaner federal government** — a hiring freeze and voluntary early-retirement packages
   to right-size Washington without leaving families behind.
4. **Lower taxes by cutting waste** — go after fraud, waste, and bloated headcount first, so relief
   is funded by efficiency, not gimmicks.

> *Families, fair justice, honesty, service, and opportunity for all — those are the values that
> guide this campaign.*

Full detail: [candidate/profile.md](candidate/profile.md) · [candidate/platform.md](candidate/platform.md)

---

## Built to win: the campaign operating system

This repository isn't just a website — it's the campaign's entire operating system, built to
out-organize a bigger budget with discipline and real data.

**For voters — the public campaign site**
- A fast, modern campaign website: Matt's story, the issues, press, and contact.
- One-click **donate** through WinRed and a live **countdown** to Election Day.
- **Your action plan** (`/act`) — a personalized, printable to-do list to help, with an optional
  AI-tailored brief by county, city, or school district (grounded in the platform).
- A **community hub** + shared "Peace Room" case-for-change board for supporters and coalition partners.
- Shareable, on-brand graphics and a clear ask on every page.

**For the team — the "War Room" dashboard** *(staff-only)*
- **Overview + guided setup** — a daily pulse and a "Setup & status" page showing what's wired up
  (email, texting, social, donations, research) at a glance.
- **Finance** — donor ledger with FEC employer/occupation tracking and contribution-limit flags,
  expenditures, live cash-on-hand, and an FEC filing-deadline **compliance** calendar.
- **3D field map of MO-02** — real St. Louis County precinct turnout and polling places from live
  county GIS — plus **precinct targets** that turn turnout into printable walk lists.
- **Volunteers + task board** — leads from the public form, statuses, and the final-stretch kanban.
- **Email campaigns** — branded templates, audience segments, scheduling, and built-in CAN-SPAM/FEC
  compliance with one-click unsubscribe.
- **Text blasts (SMS)** — opt-in-gated broadcasts with a segment counter, quiet hours, and automatic
  STOP/HELP handling (TCPA-compliant).
- **Social command center** — compose once and publish/schedule to every channel, with a profile optimizer.
- **AI strategy lab** (Peace Room) — responsible-governance briefs + action plans per issue, localized
  by county/city/school district and faithful to the documented platform.
- **Opposition research** — the opponent's *public* legislative record (votes + bills) from Congress.gov
  and the House Clerk, so every contrast is fact-checkable and sourced — never a fabricated claim.
- **Graphics studio + asset library** — generate posts, yard signs, and banners from Matt's photo;
  brand files on a fast CDN.
- **Strategic plan** to run the final stretch to August 4.

**Under the hood:** Next.js · AWS DynamoDB · S3 + CloudFront · Clerk auth · Amazon SES (email) ·
Twilio (SMS) · Anthropic Claude (AI) · deployed on AWS Amplify.
Setup and deploy: [web/README.md](web/README.md) · [docs/RUNBOOK.md](docs/RUNBOOK.md) ·
[docs/DEPLOY-AWS.md](docs/DEPLOY-AWS.md).

---

## Join the effort

This race is decided one neighbor at a time.

- **[Donate today](https://secure.winred.com/matt-grant-for-congress/donate-today)** — every dollar
  funds doors knocked and neighbors reached before August 4.
- **Volunteer** — knock doors, make calls, host an event, or put up a sign. Reach the campaign at
  **mattgrantforcongress@gmail.com** · **(314) 255-7760**.

---

## What's in this repo

| Path | What it is |
|---|---|
| [`web/`](web/) | The campaign website + War Room dashboard — the live Next.js app |
| [`candidate/`](candidate/) | Matt's profile, platform, strategic plan, and contrast positioning |
| [`docs/`](docs/) · [`infra/`](infra/) · [`scripts/`](scripts/) | Deploy + ops: AWS Amplify/DynamoDB/S3 runbooks, EventBridge/SSM setup scripts |
| [`SKILL.md`](SKILL.md) · [`INDEX.md`](INDEX.md) · [`commands/`](commands/) | The Claude AI Skill entry point, file index, and 80+ slash-command triggers |
| [`workflows/`](workflows/) · [`tactics/`](tactics/) | Step-by-step campaign processes and operational playbooks |
| [`messaging/`](messaging/) · [`outreach/`](outreach/) · [`artifacts/`](artifacts/) | Positioning, speeches, press, social, email, and document-generation templates |
| [`federal/`](federal/) · [`states/`](states/) · [`tools/`](tools/) · [`references/`](references/) | FEC + state election-law references, compliance trackers, glossary, and agency directory |

Beneath the Grant-specific files, this is a general-purpose, nonpartisan **get-elected** toolkit —
it retains full capability for running a legally compliant, strategically sound race for any U.S.
office, school board to Congress.

## Guardrails

- **Faithful, not fabricated.** Matt's positions are documented from his published platform. No
  invented policy, quotes, polls, or endorsements. Opponent contrast uses only sourced public record.
- **Educational, not legal advice.** Compliance tooling is informational — verify with the FEC and
  Missouri Ethics Commission.
- **No dark arts.** No voter suppression, disinformation, fake endorsements, or illegal coordination.

---

<div align="center">

**Paid for by the Matt Grant for Congress Committee.**

</div>
