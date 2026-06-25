"use client";

import { useEffect } from "react";

// Draws any <div class="mermaid"> blocks emitted by lib/markdown.ts into SVG
// diagrams on the client. Rendered only on pillar doc pages that actually contain
// a diagram (the parent gates on the html string), so mermaid's sizable bundle is
// dynamically imported and never ships with pages that don't need it.
//
// Threat model: the diagram source comes from external dougdevitre/access-to-*
// repos, so mermaid runs with securityLevel:"strict" (HTML in node labels is
// escaped, click/JS directives are disabled). Each block is validated with
// mermaid.parse first and rendered independently; an invalid or malformed upstream
// diagram simply keeps its raw text instead of an error graphic or a broken page.
export function MermaidRender() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(".mermaid"));
      if (nodes.length === 0) return;

      const mermaid = (await import("mermaid")).default;
      if (cancelled) return;

      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });

      for (const node of nodes) {
        if (cancelled) return;
        const src = node.textContent ?? "";
        try {
          // parse(..., { suppressErrors: true }) resolves false on invalid syntax
          // (no throw, no error graphic) — skip those, leaving the raw text.
          const ok = await mermaid.parse(src, { suppressErrors: true });
          if (ok === false) continue;
          await mermaid.run({ nodes: [node] });
        } catch {
          node.textContent = src; // restore raw source as a graceful fallback
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
