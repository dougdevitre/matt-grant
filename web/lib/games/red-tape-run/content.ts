import raw from "@/content/games/red-tape-run.json";
import { GameContentSchema, type GameContent } from "@/lib/games/content-schema";
import { RedTapeRunConfigSchema, type RedTapeRunConfig } from "./config.schema";
import { makeRedTapeRun } from "./reducer";

// Validate on import so a malformed edit fails fast (and content-lint catches it in CI).
export const redTapeRunContent: GameContent = GameContentSchema.parse((raw as { copy: unknown }).copy);
export const redTapeRunConfig: RedTapeRunConfig = RedTapeRunConfigSchema.parse((raw as { config: unknown }).config);

/** Build a fresh, config-bound Red Tape Run game instance. */
export const buildRedTapeRun = () => makeRedTapeRun(redTapeRunConfig);
