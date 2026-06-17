import { ImageResponse } from "next/og";

export const alt = "Matt Grant for Congress — Missouri District 2";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded share card — matches the site's ink/gold identity. Uses system fonts
// and no special glyphs so it renders at build without fetching font files.
// Note (satori): every <div> with more than one child must set display:flex.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F2540",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", height: 8, width: "100%", background: "linear-gradient(90deg,#B5343B,#E0A53B,#16365C)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", color: "#E0A53B", fontSize: 30, letterSpacing: 6 }}>
            MISSOURI · DISTRICT 2
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 22, color: "#FBFAF6", fontSize: 92, fontWeight: 700 }}>
            <span>Put Missouri&apos;s</span>
            <span style={{ color: "#E0A53B" }}>children</span>
            <span>first.</span>
          </div>
          <div style={{ display: "flex", color: "rgba(251,250,246,0.75)", fontSize: 34 }}>
            Matt Grant for Congress · A neighbor, a dad, a problem-solver.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "rgba(251,250,246,0.7)", fontSize: 28 }}>
          <span>mattgrantforcongress.org</span>
          <span style={{ color: "#E0A53B" }}>Election Day · August 4, 2026</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
