"use client";

import { useState } from "react";

// Inline coalition-script generator for a candidate detail page. Calls the
// existing /api/research/script route (format=json) and renders the deterministic,
// sourced script on the page — instead of the old bare link that opened raw
// text/plain in a new tab. Staff can read it in context and copy it in one click.
// No generative fabrication happens here or server-side: the script is built from
// Matt's own platform language + the candidate's CITED stances.
export function CoalitionScript({ slug, name }: { slug: string; name: string }) {
  const [script, setScript] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/research/script?candidate=${encodeURIComponent(slug)}&format=json`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      setScript(typeof data?.script === "string" ? data.script : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the script.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is still selectable in the panel */
    }
  }

  const btn = "rounded-sm border border-line px-3 py-1.5 text-xs text-slate hover:border-ink disabled:opacity-50";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={generate} disabled={loading} className={btn}>
          {loading ? "Generating…" : script ? "Regenerate coalition script" : "Generate coalition script"}
        </button>
        {script && (
          <button type="button" onClick={copy} className={btn}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
        <a
          href={`/api/research/script?candidate=${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
        >
          open raw ↗
        </a>
      </div>

      {error && <p className="mt-2 text-xs text-brick">{error}</p>}

      {script && (
        <pre
          aria-label={`Coalition script for ${name}`}
          className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-paper/40 p-4 font-mono text-xs leading-relaxed text-ink"
        >
          {script}
        </pre>
      )}
    </div>
  );
}
