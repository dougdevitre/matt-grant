import { GAME_IDS, type GameId } from "./content-schema";

// The arcade catalog — one entry per game, mapped to the campaign issue it teaches.
// `enabled` is the build-time default; the live kill-switch state comes from
// /api/games/flags (SSM/DynamoDB) so compliance can pull a game without a deploy.
// For milestone 1 only Cut & Save is enabled; the others render "coming soon".

export interface GameMeta {
  id: GameId;
  title: string;
  issue: string; // campaign priority shown on the card
  issueSlug: string; // canonical /issues/<slug>
  blurb: string; // resource-language teaser, no policy claim
  enabled: boolean;
  /** kept in the registry (for flags/validation) but hidden from the public menu —
   *  used for prototypes still in review. Route is gated by the flag as usual. */
  hidden?: boolean;
}

export const GAMES: GameMeta[] = [
  {
    id: "cut-and-save",
    title: "Cut & Save",
    issue: "Lower Taxes",
    issueSlug: "lower-taxes",
    blurb: "Cut the waste to fund relief — without harming families or borrowing.",
    enabled: true,
  },
  {
    id: "org-chart",
    title: "Org Chart",
    issue: "Smaller Government",
    issueSlug: "smaller-government",
    blurb: "Right-size Washington to the target band — don't gut it, don't let it bloat.",
    enabled: true,
  },
  {
    id: "rotation",
    title: "Rotation",
    issue: "Term Limits",
    issueSlug: "term-limits",
    blurb: "Rotate at the service sweet spot — too early wastes ramp, too late is careerism.",
    enabled: true,
  },
  // Red Tape Run takes the Children First slot. It replaces the earlier "Clarity
  // Companion" record-triage concept (retired — its lib code remains for reference but
  // it's off the menu and its route is removed).
  {
    id: "red-tape-run",
    title: "Red Tape Run",
    issue: "Children First",
    issueSlug: "family-courts",
    blurb: "Dodge the procedural abuses in family court and grab the reforms — a fair shot for kids.",
    enabled: true,
  },
  // The Docket — Pac-Man-style "the system consumes childhood" maze. PHASE 1 prototype:
  // hidden from the public menu + flag OFF (route 404s in prod). Enable for local/preview
  // via GAMES_FLAGS={"the-docket":true} once the framing is signed off.
  {
    id: "the-docket",
    title: "The Docket",
    issue: "Children First",
    issueSlug: "family-courts",
    blurb: "Protect a child's childhood before a rigged system devours it.",
    enabled: false,
    hidden: true,
  },
];

export const getGameMeta = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
export const isGameId = (id: string): id is GameId => (GAME_IDS as readonly string[]).includes(id);
