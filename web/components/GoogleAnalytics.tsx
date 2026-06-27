import Script from "next/script";

// GA4 (gtag.js). Rendered only when NEXT_PUBLIC_GA_MEASUREMENT_ID is set, so it's
// a no-op in dev/preview unless you opt in. Defines window.gtag, which lib/
// analytics.ts track() forwards custom events to (cta_click, quick_action_click).
//
// Set NEXT_PUBLIC_GA_MEASUREMENT_ID (G-XXXXXXXXXX) in the PRODUCTION Amplify
// branch only — leaving it unset on preview branches keeps their traffic out of
// the report.
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
      </Script>
    </>
  );
}
