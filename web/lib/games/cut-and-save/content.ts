import raw from "@/content/games/cut-and-save.json";
import { GameContentSchema, type GameContent } from "@/lib/games/content-schema";
import { CutSaveConfigSchema, type CutSaveConfig } from "./config.schema";
import { makeCutAndSave } from "./reducer";

// Validate the JSON at module load so a malformed edit fails fast (and the content
// lint catches it in CI before it ships). Both the client view and the score API
// import these, guaranteeing they run the identical config.

export const cutSaveContent: GameContent = GameContentSchema.parse((raw as { copy: unknown }).copy);
export const cutSaveConfig: CutSaveConfig = CutSaveConfigSchema.parse((raw as { config: unknown }).config);

/** Build a fresh, config-bound Cut & Save game instance. */
export const buildCutAndSave = () => makeCutAndSave(cutSaveConfig);
