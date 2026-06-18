import type { MetadataRoute } from "next";
import { CAMPAIGN } from "@/lib/site";

// Web app manifest — installable "Add to Home Screen" + branded Android chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${CAMPAIGN.candidate} for Congress`,
    short_name: "Matt Grant",
    description: `${CAMPAIGN.candidate} for Congress — ${CAMPAIGN.district}. Vote ${CAMPAIGN.electionLabel}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#FBFAF6",
    theme_color: "#0F2540",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
