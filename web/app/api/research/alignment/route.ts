import { NextResponse } from "next/server";
import { loadField } from "@/lib/integrations/research/candidates";
import { loadStatements } from "@/lib/integrations/statements/data";
import { analyzeField, alignCandidate } from "@/lib/analysis/alignment";

// Computed alignment analysis as JSON — the substrate for the dashboard, the
// coalition scripts (/api/research/script), and the share cards
// (/api/research/graphic). Source-only: positions with no citation read as
// "unknown", never inferred. Public, read-only — no secrets, no PII.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("candidate");
  const field = loadField().filter((c) => c.active !== false);
  const statements = loadStatements();

  if (slug) {
    const c = field.find((x) => x.slug === slug);
    if (!c) return NextResponse.json({ error: `unknown candidate: ${slug}` }, { status: 404 });
    return NextResponse.json({ generatedAt: new Date().toISOString(), candidate: alignCandidate(c, statements) });
  }

  return NextResponse.json(analyzeField(field, statements, new Date().toISOString()));
}
