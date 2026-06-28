# Personalized Campaign Agenda — Supporter Action Plans

A dynamically generated, Matt-Grant-branded **action plan** a supporter can print: a daily or weekly
checklist that adjusts to **where they live** and the **one of four issues** they choose to champion —
every item oriented toward **awareness and turnout for August 4**.

## What's built (live)

- **`/act` — "Take Action"** page: pick your area (free text + MO-02 quick-picks), choose the priority
  you'll champion (the four issues), and a **daily** or **weekly** cadence → a branded, printable plan.
- **`web/lib/actions.ts`** — a **deterministic** generator (no random/clock, so prints are stable and
  React-pure). It mixes themed building blocks — *Be ready · Learn · Share · Talk · Recruit · Materials
  · GOTV* — and fills `{area}` / `{issue}` into each action. The issue rotates the selection so each of
  the four priorities yields a different mix.
- **`AgendaBuilder.tsx`** — the form + the printable plan (logo, checkboxes, day themes, "Vote Aug 4"
  footer + paid-for-by). A **Print / Save as PDF** button; print CSS isolates the plan (no nav/footer).
- Linked from the main nav ("Take Action").

## How it personalizes

| Input | Effect |
|---|---|
| **Area** (town/county) | Actions name the place: "Tell 3 neighbors in *Wildwood*…", "Put up a yard sign in *Jefferson County*." |
| **Issue** (1 of 4) | Learn/share/talk items reference that priority + link to its `/issues/<slug>` page and graphics. |
| **Cadence** | *Daily* = one focused day (5 actions). *Weekly* = a 7-day arc: Get ready → Learn → Share → Talk → Recruit → Materials → GOTV. |

Every plan ladders to the same goal: **build awareness and turn out the vote on August 4.** Faithful to
the platform — actions are organizing steps, no fabricated facts.

## Future enhancements

1. **Email/save the plan** — "email me this plan" → ties into the email system + subscriber list;
   a weekly EventBridge send of a fresh plan.
2. **Sharper localism** — map ZIP/town → MO-02 region, polling place, and nearby events (verified
   data only).
3. **Progress + gamification** — check-offs that sync (signed-in supporters), streaks, a leaderboard
   by area.
4. **More action types** — phone/text banking scripts, letter-to-the-editor prompts, event hosting.
5. **Printable PDF endpoint** — server-rendered branded PDF (like the print kit) for a polished
   handout, in addition to browser print.
6. **Dashboard view** — staff see which areas/issues supporters are activating around.

_Paid for by Matt Grant for Congress._
