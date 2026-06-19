import { ImageResponse } from "next/og";
import { loadField, partyLabel } from "@/lib/integrations/research/candidates";
import { loadStatements } from "@/lib/integrations/statements/data";
import { alignCandidate } from "@/lib/analysis/alignment";
import { ISSUE_AXES } from "@/lib/integrations/research/issues";

// "Common ground" share card for one candidate: which of Matt's four pillars
// they align on (from SOURCED statements), the alignment score, and a
// sourced-statements footer. Reuses the brand palette from /api/graphics.
export const runtime = "nodejs";

const NAVY = "#0F2540";
const GOLD = "#E0A53B";
const PAPER = "#FBFAF6";
const MUTED = "#9fb0c2";
const FIELD = "#3f7d52";
const BRICK = "#B5343B";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("candidate") ?? "";
  const c = loadField().find((x) => x.slug === slug);
  if (!c) return new Response(`unknown candidate: ${slug}`, { status: 404 });
  const a = alignCandidate(c, loadStatements());
  const scorePct = a.score === null ? "—" : `${Math.round(a.score * 100)}%`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: "flex",
          flexDirection: "column",
          background: NAVY,
          color: PAPER,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", color: GOLD, fontSize: 30, letterSpacing: 6 }}>COMMON GROUND · MO-02</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 12 }}>{c.name}</div>
        <div style={{ display: "flex", color: MUTED, fontSize: 34, marginTop: 8 }}>
          {partyLabel(c.party)} · aligns with Matt Grant on {a.bridges.length} of 4
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 56 }}>
          {ISSUE_AXES.map((ax) => {
            const v = a.axes.find((x) => x.issueId === ax.id)!.verdict;
            const mark = v === "agree" ? "✓" : v === "differ" ? "✕" : "·";
            const color = v === "agree" ? FIELD : v === "differ" ? BRICK : MUTED;
            return (
              <div key={ax.id} style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 40 }}>
                <div style={{ display: "flex", width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 12, background: color, color: NAVY, fontWeight: 700 }}>
                  {mark}
                </div>
                <div style={{ display: "flex", color: v === "unknown" ? MUTED : PAPER }}>{ax.label}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 700, color: GOLD }}>{scorePct}</div>
            <div style={{ display: "flex", color: MUTED, fontSize: 26 }}>alignment on known issues</div>
          </div>
          <div style={{ display: "flex", color: MUTED, fontSize: 22, maxWidth: 420, textAlign: "right" }}>
            From sourced public statements. Cite the source on every claim.
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
