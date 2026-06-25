import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Regression guard for the tool iframe sandbox. `allow-scripts` + `allow-same-origin`
// together let untrusted framed HTML escape the sandbox and script the app's own
// origin — so allow-same-origin must never come back on this iframe. A string check
// is intentionally blunt: it can't be silently undone in a refactor.
describe("pillar tool iframe sandbox", () => {
  const page = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "[tool]", "page.tsx"),
    "utf8",
  );

  it("never grants the embedded tool same-origin access", () => {
    const sandbox = /sandbox="([^"]*)"/.exec(page)?.[1] ?? "";
    expect(sandbox, "no sandbox attribute found on the tool iframe").not.toBe("");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(sandbox).toContain("allow-scripts");
  });
});
