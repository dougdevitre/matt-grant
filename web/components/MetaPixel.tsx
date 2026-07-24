"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Meta (Facebook) Pixel. Rendered only when NEXT_PUBLIC_META_PIXEL_ID is set, so it's
// a no-op in dev/preview and inert until you opt in — committing this code turns
// nothing on. Defines window.fbq, which lib/analytics.ts track() forwards CTA events
// to (alongside GA), so ad campaigns can measure/optimize toward opt-ins and donations.
//
// Privacy: there's no cookie-consent banner (matching the existing GA setup), so we
// enable Meta's Limited Data Use by default — dataProcessingOptions(['LDU'], 0, 0)
// lets Meta geolocate and apply LDU where required (e.g. California/CCPA). The Meta
// Pixel is disclosed on /data-policy. Set NEXT_PUBLIC_META_PIXEL_ID (a numeric Pixel/
// dataset ID) in the PRODUCTION Amplify branch only, and complete Meta's data terms.
//
// Page views: the init script sends the first PageView; Next.js client navigations
// aren't seen by the pixel, so the effect sends a PageView on every SUBSEQUENT route
// change (skipping the first run to avoid double-counting the landing view).
export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false; // landing PageView is sent by the init script
      return;
    }
    // Keep staff dashboard traffic out of the campaign's ad measurement.
    if (pathname.startsWith("/dashboard")) return;
    const w = window as Window & { fbq?: (...args: unknown[]) => void };
    if (typeof w.fbq !== "function") return;
    w.fbq("track", "PageView");
  }, [pathname]);

  // Don't load the pixel at all on dashboard routes (e.g. a staff member landing there).
  if (pathname.startsWith("/dashboard")) return null;

  return (
    <Script id="meta-pixel-init" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('dataProcessingOptions', ['LDU'], 0, 0);
fbq('init', '${pixelId}');
fbq('track', 'PageView');`}
    </Script>
  );
}
