import raw from "@/content/games/the-docket.json";
import { GameContentSchema, type GameContent } from "@/lib/games/content-schema";
import { DocketConfigSchema, type DocketConfig } from "./config.schema";
import { makeTheDocket } from "./reducer";

// Validate on import so a malformed maze/edit fails fast (and content-lint catches it).
export const docketContent: GameContent = GameContentSchema.parse((raw as { copy: unknown }).copy);
export const docketConfig: DocketConfig = DocketConfigSchema.parse((raw as { config: unknown }).config);

/** Build a fresh, config-bound The Docket game instance. */
export const buildTheDocket = () => makeTheDocket(docketConfig);
