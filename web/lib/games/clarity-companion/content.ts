import raw from "@/content/games/clarity-companion.json";
import { GameContentSchema, type GameContent } from "@/lib/games/content-schema";
import { ClarityConfigSchema, type ClarityConfig } from "./config.schema";
import { makeClarityCompanion } from "./reducer";

// Validate on import so a malformed edit fails fast (and content-lint catches it in CI).
export const clarityContent: GameContent = GameContentSchema.parse((raw as { copy: unknown }).copy);
export const clarityConfig: ClarityConfig = ClarityConfigSchema.parse((raw as { config: unknown }).config);

/** Build a fresh, config-bound Clarity Companion game instance. */
export const buildClarityCompanion = () => makeClarityCompanion(clarityConfig);
