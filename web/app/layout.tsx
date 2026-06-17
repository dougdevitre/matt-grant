import type { Metadata } from "next";
import { Fraunces, Public_Sans, Spline_Sans_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/auth";
import { CAMPAIGN } from "@/lib/site";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://mattgrantforcongress.org"),
  title: {
    default: `${CAMPAIGN.candidate} for Congress — ${CAMPAIGN.districtShort}`,
    template: `%s · ${CAMPAIGN.candidate} for Congress`,
  },
  description:
    "Matt Grant is a neighbor, a dad, and a problem-solver running for Congress in Missouri's 2nd District to put children first, end family-court corruption, and bring term limits to Washington.",
  openGraph: {
    title: `${CAMPAIGN.candidate} for Congress — ${CAMPAIGN.district}`,
    description: "Putting Missouri's children first. Election day: August 4, 2026.",
    type: "website",
    images: [{ url: "/brand/og-card.png", width: 1200, height: 630, alt: "Matt Grant for Congress" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${CAMPAIGN.candidate} for Congress — ${CAMPAIGN.districtShort}`,
    description: "Putting Missouri's children first. Election day: August 4, 2026.",
    images: ["/brand/og-card.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );

  return clerkEnabled ? <ClerkProvider>{body}</ClerkProvider> : body;
}
