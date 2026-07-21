# Four Fights Arcade (`games.mattgrantforcongress.org`)

A civic mini-game suite mapped to the four campaign priorities — five games in all, with
**Children First** carrying two. Folded into **this same Next.js app** (not a separate
repo): it reuses the subdomain router, the FEC compliance gate, the SSM-secret pattern,
DynamoDB, and the shared chrome. The engineering spec is `four-fights-arcade.md` (repo root
context); this doc is the as-built map. The catalog source of truth is
`lib/games/registry.ts`.

## The games ↔ the four priorities

| Game | Priority | Issue slug (`lib/issues.ts`) | Status |
|---|---|---|---|
| **Cut & Save** | Lower Taxes | `lower-taxes` | **Live** |
| **Org Chart** | Smaller Government | `smaller-government` | **Live** |
| **Rotation** | Term Limits | `term-limits` | **Live** |
| **Red Tape Run** | Children First | `family-courts` | **Live** |
| **The Docket** | Children First | `family-courts` | **Live** |

> **Clarity Companion** (an earlier Children First record-triage concept) was retired —
> **Red Tape Run** took its slot. Its lib code remains for reference, but it's off the menu
> and its route is removed.

## How it's wired

```
games.mattgrantforcongress.org/cut-and-save
        │  reserved-subdomain rewrite (middleware.ts → lib/pillar-routing.ts)
        ▼
/games/cut-and-save        ← app/games/**, reuses SiteHeader/SiteFooter (disclaimer)
        │
        ├─ lib/games/engine/**     deterministic, seeded sim (no React, no wall-clock)
        ├─ lib/games/cut-and-save/ pure reducer + zod config + content loader
        ├─ content/games/*.json    copy + tuning (validated; non-engineer editable)
        └─ app/api/games/**        score (replay-validated) · leaderboard · lead · flags
```

- **Engine (`lib/games/engine`).** A `Game<State,Input,Config>` contract advanced by a
  fixed 30 Hz timestep, driven only by a seeded PRNG (`rng.ts`). `replay(seed, inputs)`
  is the single code path the client renders with AND the score API re-runs to validate
  — same inputs → same score, on both sides. No `Math.random`/`Date.now` inside a sim.
- **Game (`lib/games/cut-and-save`).** Pure reducer. The lesson IS the winning strategy:
  cut waste (funds relief), don't cut essentials (harms families) or decoys (pay for
  themselves), and ignore the Borrow gimmick (compounds into debt). Two-sided fail, so
  neither "cut everything" nor "cut nothing" wins.
- **Content (`content/games/*.json`).** Copy + balance as data. Validated by
  `npm run games:content-lint` (zod schema + a tone guardrail that bans named persons).
  The FEC disclaimer is **not** in content — every screen renders `CAMPAIGN.paidForBy`.
- **API (`app/api/games`).** `POST /score` rate-limits, re-runs `replay`, rejects (422)
  any score it can't reproduce, clamps to the ceiling, stores an anonymous
  (initials + score) row in DynamoDB. `GET /leaderboard` returns top-N (no PII).
  `POST /lead` is an optional opt-in (phone needs `sms_consent`; Airtable target is
  config). `GET /flags` is the per-game kill switch (registry default, SSM override).

## Compliance

- **Disclaimer on every screen + share card.** Reused `SiteFooter` (page) +
  `ShareCard`/`EndScreen` render `CAMPAIGN.paidForBy`. `npm run compliance` is the same
  gate Amplify runs in preBuild; it blocks the deploy if the disclaimer regresses.
- **No named persons.** The content tone guardrail (`lib/games/content-schema.ts`) fails
  the lint on any judge/official name — items are categories only.
- **Kill switch.** Set SSM `/matt-grant/GAMES_FLAGS` to a JSON map like
  `{"cut-and-save": false}` to pull a game without a deploy; the menu and the game page
  both honor it.

## Config / secrets (ops)

| Key | Where | Purpose |
|---|---|---|
| `GAMES_FLAGS` | SSM `/matt-grant/` (optional) | Per-game enable override (kill switch). |
| `GAMES_LEAD_BASE_ID` | env or SSM | Airtable base that receives opt-in leads. |
| `GAMES_LEAD_TABLE_ID` | env or SSM | Airtable table for opt-in leads. |

Until the lead base/table are set, `POST /lead` returns a neutral 503 (no silent drop).
The DynamoDB leaderboard uses the existing table (`PK.gameScores`); no new infra.

## Adding the next game

1. `lib/games/<game>/reducer.ts` (pure `Game`), `config.schema.ts`, and
   `content/games/<game>.json`.
2. Register it in `lib/games/server/validate.ts` (one validator entry) and
   `lib/games/registry.ts` (set `enabled`).
3. A view component + `app/games/<game>/page.tsx`.
4. Tests: golden replay/determinism + the two-sided fail invariants. Run
   `npm run games:content-lint` and `npm test`.

## Verify locally

```
npm test                                   # engine + reducer + routing + validate
npm run games:content-lint                 # schema + tone guardrail
npm run compliance                         # FEC disclaimer gate
# subdomain: send Host: games.mattgrantforcongress.org → rewrites to /games
```
