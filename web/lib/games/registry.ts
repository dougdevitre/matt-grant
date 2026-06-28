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
    enabled: false,
  },
  {
    id: "rotation",
    title: "Rotation",
    issue: "Term Limits",
    issueSlug: "term-limits",
    blurb: "Rotate at the service sweet spot — too early wastes ramp, too late is careerism.",
    enabled: false,
  },
  {
    id: "clarity-companion",
    title: "Clarity Companion",
    issue: "Children First",
    issueSlug: "family-courts",
    blurb: "Open the public record, protect the child — transparency and privacy together.",
    enabled: false,
  },
];

export const getGameMeta = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
export const isGameId = (id: string): id is GameId => (GAME_IDS as readonly string[]).includes(id);
