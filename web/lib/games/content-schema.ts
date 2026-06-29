import { z } from "zod";

// Player-facing copy for a game, validated as DATA so a non-engineer can tune
// wording without touching game logic (spec §3 "content is data, not code").
//
// TONE GUARDRAIL (spec §9): items are CATEGORIES only — never named people, judges,
// agencies, or opponents. The refine below fails the build (`pnpm games:content-lint`)
// on any banned token, so off-message copy can't ship. We deliberately keep the
// disclaimer OUT of this schema: every screen renders CAMPAIGN.paidForBy from
// lib/site.ts (the single source of truth the compliance gate enforces), so there is
// no hard-coded disclaimer literal here to drift.

export const GAME_IDS = ["cut-and-save", "org-chart", "rotation", "clarity-companion", "red-tape-run", "the-docket"] as const;
export type GameId = (typeof GAME_IDS)[number];

// Reject "Judge Smith", "Hon. Doe", "Honorable Roberts" and bare proper-name pairs in
// item copy. Categories ("Audit office", "Duplicate contract") pass; names don't.
const NAMED_PERSON =
  /\b(judge|hon\.?|honorable|senator|rep\.?|representative|congressman|congresswoman)\s+[A-Z][a-z]+/;
const noNamedPersons = (s: string) => !NAMED_PERSON.test(s);

const ShortLine = z.string().min(1).max(140).refine(noNamedPersons, "no named persons allowed");

export const GameContentSchema = z
  .object({
    gameId: z.enum(GAME_IDS),
    /** canonical issue this game teaches, e.g. "lower-taxes" — links back to /issues/<slug> */
    issueSlug: z.string().min(1),
    eyebrow: ShortLine,
    title: ShortLine,
    tagline: ShortLine,
    /** 1–4 quick how-to-play lines */
    howTo: z.array(ShortLine).min(1).max(4),
    /** category labels keyed by item type — what the player reads on a tile */
    itemLabels: z.record(z.string(), z.array(ShortLine).min(1)),
    /** ≤3 end-screen takeaway lines (the lesson, stated plainly) */
    endLines: z.array(ShortLine).max(3),
    shareText: ShortLine,
    /** OPTIONAL narrative ending (The Docket Phase 4): the moral-injury beat, then a
     *  reform plan whose steps are drawn ONLY from the documented campaign platform —
     *  no invented policy. Tone guardrail (no named persons) applies to every line. */
    ending: z
      .object({
        /** beat copy when the player clears every stage */
        beatWon: ShortLine,
        /** beat copy when the system catches the player */
        beatLost: ShortLine,
        /** 1–3 lines naming the moral-injury toll (framing, not policy) */
        body: z.array(ShortLine).min(1).max(3),
        reformHeading: ShortLine,
        /** the reform plan — each step faithful to the documented platform */
        reformPlan: z.array(z.object({ title: ShortLine, detail: ShortLine }).strict()).min(1).max(10),
        cta: z.object({ label: ShortLine, href: z.string().min(1).regex(/^\//, "internal path") }).strict(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type GameContent = z.infer<typeof GameContentSchema>;
