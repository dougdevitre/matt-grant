// Provider-agnostic event tracking. A no-op until an analytics provider is
// present on the page, so the conversion actions can be instrumented now and
// start reporting the moment a provider is added — no component changes needed.
//
// To enable, add ONE provider snippet to app/layout.tsx (or via a tag manager):
//   • GA4 / GTM  → defines window.gtag / window.dataLayer
//   • Plausible  → defines window.plausible
//   • PostHog    → defines window.posthog
// track() forwards to whichever is found. The Meta Pixel (window.fbq, from
// components/MetaPixel.tsx) is ALSO forwarded to, independently — so the same CTA
// events feed both the web-analytics provider AND Meta ad measurement/optimization.

type Props = Record<string, string | number | boolean>;

type AnalyticsWindow = Window & {
  gtag?: (command: "event", event: string, props?: Props) => void;
  plausible?: (event: string, options?: { props?: Props }) => void;
  posthog?: { capture?: (event: string, props?: Props) => void };
  dataLayer?: Array<Record<string, unknown>>;
  fbq?: (command: "trackCustom" | "track", event: string, props?: Props) => void;
};

export function track(event: string, props: Props = {}): void {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  try {
    if (typeof w.gtag === "function") w.gtag("event", event, props);
    else if (typeof w.plausible === "function") w.plausible(event, { props });
    else if (w.posthog?.capture) w.posthog.capture(event, props);
    else if (Array.isArray(w.dataLayer)) w.dataLayer.push({ event, ...props });
    // else: no web-analytics provider installed — silently no-op.

    // Meta Pixel is INDEPENDENT of the provider chain above (a campaign can run both
    // GA and the pixel). Custom events show up in Meta for optimization/reporting; the
    // pixel is only present when NEXT_PUBLIC_META_PIXEL_ID is configured.
    if (typeof w.fbq === "function") w.fbq("trackCustom", event, props);
  } catch {
    // Analytics must never break the UI.
  }
}
