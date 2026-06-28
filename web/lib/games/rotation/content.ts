import raw from "@/content/games/rotation.json";
import { GameContentSchema, type GameContent } from "@/lib/games/content-schema";
import { RotationConfigSchema, type RotationConfig } from "./config.schema";
import { makeRotation } from "./reducer";

// Validate on import so a malformed edit fails fast (and content-lint catches it in CI).
export const rotationContent: GameContent = GameContentSchema.parse((raw as { copy: unknown }).copy);
export const rotationConfig: RotationConfig = RotationConfigSchema.parse((raw as { config: unknown }).config);

/** Build a fresh, config-bound Rotation game instance. */
export const buildRotation = () => makeRotation(rotationConfig);
