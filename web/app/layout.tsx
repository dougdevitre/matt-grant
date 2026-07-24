import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans, Spline_Sans_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";
import { CAMPAIGN } from "@/lib/site";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { MetaPixel } from "@/components/MetaPixel";
import { ErrorReporter } from "@/components/ErrorReporter";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz"],
  display: "swap",
});

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0F2540", // navy browser chrome on mobile
};

export const metadata: Metadata = {
  metadataBase: new URL("https://mattgrantforcongress.org"),
  icons: {
    icon: [
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: { url: "/brand/icon-192.png", sizes: "192x192" },
    shortcut: "/brand/icon-192.png",
  },
  title: {
    default: `${CAMPAIGN.candidate} for Congress — ${CAMPAIGN.districtShort}`,
    template: `%s · ${CAMPAIGN.candidate} for Congress`,
  },
  description:
    "Matt Grant is a neighbor, a dad, and a problem-solver running for Congress in Missouri's 2nd District to put children first, end family-court corruption, and bring term limits to Washington.",
  openGraph: {
    // No title/description here: Next falls back per-page to each route's own
    // title + description, so /issues, /join, etc. get distinct share cards.
    // The homepage falls back to the title.default + description above.
    type: "website",
    siteName: `${CAMPAIGN.candidate} for Congress`,
    // Image comes from the dynamic app/opengraph-image.tsx (red/white/blue card).
  },
  twitter: {
    // Same fallback as openGraph — twitter.title/description derive from the
    // page's own metadata rather than a single generic string.
    card: "summary_large_image",
    // Image comes from app/twitter-image.tsx.
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const body = (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <ErrorReporter />
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
        {metaPixelId ? <MetaPixel pixelId={metaPixelId} /> : null}
      </body>
    </html>
  );

  return clerkEnabled ? <ClerkProvider>{body}</ClerkProvider> : body;
}
