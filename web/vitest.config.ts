import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirror the tsconfig `@/*` → `./*` path alias so tests import like the app.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
