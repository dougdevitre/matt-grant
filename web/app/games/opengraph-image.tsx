import { renderOgCard } from "@/lib/og";

// Social card for the arcade landing (/games + the games. subdomain home). Each
// game route has its own card; this one covers the menu.
export const runtime = "nodejs";
export const alt = "Four Fights Arcade — Matt Grant for Congress";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderOgCard({
    eyebrow: "FOUR FIGHTS ARCADE",
    line1: "Play the",
    line2: "issues.",
    name: "Matt Grant for Congress",
    footer: "games.mattgrantforcongress.org",
  });
}
