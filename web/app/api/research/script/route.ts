import { NextResponse } from "next/server";
import { loadField, partyLabel } from "@/lib/integrations/research/candidates";
import { loadStatements } from "@/lib/integrations/statements/data";
import { alignCandidate } from "@/lib/analysis/alignment";
import { axis } from "@/lib/integrations/research/issues";

// Templated coalition / outreach script for ONE candidate, built deterministically
// from their SOURCED alignment with Matt. No generative fabrication of positions
// or quotes — only Matt's own platform language plus the candidate's cited stances.
// Use to court an exiting competitor or speak to a rival's persuadable supporters.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("candidate");
  if (!slug) return NextResponse.json({ error: "pass ?candidate=<slug>" }, { status: 400 });

  const c = loadField().find((x) => x.slug === slug);
  if (!c) return NextResponse.json({ error: `unknown candidate: ${slug}` }, { status: 404 });

  const a = alignCandidate(c, loadStatements());
  const lines: string[] = [];

  lines.push(`COALITION SCRIPT — ${c.name} (${partyLabel(c.party)})`);
  lines.push(`Common ground with Matt Grant · MO-02 · Aug 4, 2026 primary`);
  lines.push("");

  if (a.bridges.length === 0) {
    lines.push("No sourced common ground recorded yet. Curate cited statements before using this script.");
    lines.push("Every claim about a candidate's position must carry a source_url (see candidate/contrast-positioning.md).");
  } else {
    lines.push(`SHARED PRIORITIES (${a.bridges.length} of 4) — lead here:`);
    for (const id of a.bridges) {
      const ax = a.axes.find((x) => x.issueId === id)!;
      lines.push(`• ${ax.label}: we both back this. Matt — "${axis(id).mattSummary}"`);
      if (ax.summary) lines.push(`  Their position: ${ax.summary}`);
      lines.push(`  [SOURCE: ${ax.sourceUrl ?? "ADD SOURCE BEFORE PUBLISH"}]`);
    }
    lines.push("");
    lines.push("THE ASK: \"We agree on more than the ballot suggests. Let's put those wins for MO-02 families first.\"");
  }

  if (a.contrasts.length > 0) {
    lines.push("");
    lines.push("ACKNOWLEDGE HONESTLY (don't paper over):");
    for (const id of a.contrasts) {
      const ax = a.axes.find((x) => x.issueId === id)!;
      lines.push(`• ${ax.label}: difference on record. [SOURCE: ${ax.sourceUrl ?? "ADD SOURCE"}]`);
    }
  }
  if (a.unknowns.length > 0) {
    lines.push("");
    lines.push(`UNKNOWN (no sourced position — do NOT assume): ${a.unknowns.map((id) => axis(id).label).join(", ")}`);
  }

  lines.push("");
  lines.push("— Factual, sourced contrast only. Have election counsel confirm disclaimers before any public use.");

  const text = lines.join("\n");
  if (sp.get("format") === "json") {
    return NextResponse.json({ candidate: c.slug, alignment: a, script: text });
  }
  return new NextResponse(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
