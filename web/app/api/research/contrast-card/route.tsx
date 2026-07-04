import { ImageResponse } from "next/og";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { loadField } from "@/lib/integrations/research/candidates";
import { loadStatements } from "@/lib/integrations/statements/data";
import { alignCandidate } from "@/lib/analysis/alignment";
import { cardModel } from "@/lib/analysis/contrastCard";
import { dbConfigured } from "@/lib/db";
import { getFecDetail } from "@/lib/integrations/research/store";
import type { FecDetail } from "@/lib/integrations/fec/types";

// "Where they differ" contrast card — the counterpart to /api/research/graphic
// (common ground). Surfaces only SOURCED disagreements on Matt's four pillars,
// plus the outside-money picture, so a contrast share-card never overclaims.
// Reuses the brand palette from /api/graphics; view-model in lib/analysis/contrastCard.
export const runtime = "nodejs";

const NAVY = "#0F2540";
const GOLD = "#E0A53B";
const PAPER = "#FBFAF6";
const MUTED = "#9fb0c2";
const BRICK = "#B5343B";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function GET(req: Request) {
  const rl = await rateLimit(`contrast-card:${clientIp(req)}`, { limit: 60, windowSec: 60 });
  if (!rl.allowed) return new Response("Too many requests — please slow down.", { status: 429 });

  const slug = new URL(req.url).searchParams.get("candidate") ?? "";
  const c = loadField().find((x) => x.slug === slug);
  if (!c) return new Response(`unknown candidate: ${slug}`, { status: 404 });

  const a = alignCandidate(c, loadStatements());
  let detail: FecDetail | null = null;
  if (dbConfigured) {
    try {
      detail = await getFecDetail(slug);
    } catch {
      /* degrade — the money line is optional */
    }
  }
  const m = cardModel(c, a, detail);

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
        <div style={{ display: "flex", color: GOLD, fontSize: 30, letterSpacing: 6 }}>WHERE THEY DIFFER · MO-02</div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 12 }}>{m.name}</div>
        <div style={{ display: "flex", color: MUTED, fontSize: 34, marginTop: 8 }}>
          {m.party} · differs from Matt Grant on {m.differCount} of 4
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 56, flex: 1 }}>
          {m.contrasts.length === 0 ? (
            <div style={{ display: "flex", color: MUTED, fontSize: 38 }}>
              No sourced disagreements on the four pillars.
            </div>
          ) : (
            m.contrasts.slice(0, 4).map((x) => (
              <div key={x.label} style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                <div style={{ display: "flex", width: 54, height: 54, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 12, background: BRICK, color: NAVY, fontSize: 34, fontWeight: 700 }}>
                  ✕
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{x.label}</div>
                  <div style={{ display: "flex", color: MUTED, fontSize: 24, marginTop: 4, maxWidth: 820 }}>
                    Matt: {x.matt}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {m.support !== null || m.oppose !== null ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 24, fontSize: 30 }}>
                <div style={{ display: "flex", color: "#3f7d52" }}>{m.support !== null ? `${usd(m.support)} for` : ""}</div>
                <div style={{ display: "flex", color: BRICK }}>{m.oppose !== null ? `${usd(m.oppose)} against` : ""}</div>
              </div>
              <div style={{ display: "flex", color: MUTED, fontSize: 22, marginTop: 4 }}>outside money (FEC Schedule E)</div>
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
          <div style={{ display: "flex", color: MUTED, fontSize: 22, maxWidth: 420, textAlign: "right" }}>
            From sourced public statements. Cite the source on every claim.
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
