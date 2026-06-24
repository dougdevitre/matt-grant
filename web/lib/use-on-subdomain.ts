"use client";

import { useEffect, useState } from "react";
import { pillarSlugs } from "@/lib/pillars";

// True when the page is being viewed on a pillar subdomain
// (e.g. education.mattgrantforcongress.org). Starts false so SSR and the first
// client render agree (no hydration mismatch); flips after mount if the host's
// leftmost label is a known pillar. Used to absolutize main-site nav links so
// they cross back to the apex instead of 404-ing on the subdomain.
export function useOnSubdomain(): boolean {
  const [onSubdomain, setOnSubdomain] = useState(false);
  useEffect(() => {
    const label = window.location.hostname.split(".")[0].toLowerCase();
    setOnSubdomain(pillarSlugs.includes(label));
  }, []);
  return onSubdomain;
}
