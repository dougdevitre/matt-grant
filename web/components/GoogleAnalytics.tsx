"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// GA4 (gtag.js). Rendered only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so it's
// a no-op in dev/preview unless you opt in. Defines window.gtag, which lib/
// analytics.ts track() forwards custom events to (cta_click, quick_action_click).
//
// Page views: gtag's config sends the FIRST page_view on load (reliable — it
// fires once gtag.js is in). Next.js navigations are client-side, which gtag
// doesn't see, so the effect below sends a page_view on every SUBSEQUENT route
// change. It deliberately skips the first run to avoid double-counting the
// landing view, and avoids racing the init script (which may not have defined
// gtag yet at mount).
//
// Set NEXT_PUBLIC_GA_MEASUREMENT_ID (G-XXXXXXXXXX) in the PRODUCTION Amplify
// branch only — leaving it unset on preview branches keeps their traffic out.
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false; // landing page_view is sent by gtag config
      return;
    }
    // Keep staff dashboard traffic out of the campaign's analytics.
    if (pathname.startsWith("/dashboard")) return;
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag !== "function") return;
    w.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  // Don't load GA at all on dashboard routes (e.g. a staff member landing there).
  if (pathname.startsWith("/dashboard")) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
