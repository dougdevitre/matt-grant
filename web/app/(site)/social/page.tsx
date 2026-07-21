import type { Metadata } from "next";
import { CAMPAIGN } from "@/lib/site";
import { SocialToolkit } from "@/components/site/SocialToolkit";

export const metadata: Metadata = {
  title: "Share the Campaign — Social Toolkit",
  description:
    "Grab a ready-to-post message and a matching graphic for X, Facebook, Instagram, LinkedIn, TikTok, YouTube, or Threads. Approved campaign content — copy, add an image, and share.",
};

export default function SocialPage() {
  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">Get involved</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Share the campaign.</h1>
      <p className="mt-5 max-w-prose text-lg text-ink/80">
        The fastest way to help is to spread the word. Pick a message below and get copy-ready
        text sized for every platform — the required <span className="whitespace-nowrap">“Paid for by”</span> line
        is already included — plus a branded graphic you can download. No account needed.
      </p>
      <p className="mt-3 max-w-prose text-sm text-slate">
        These are Matt&apos;s approved campaign messages. Share them as they are, or add your own
        thoughts in your post — just keep the facts accurate to the platform below.
      </p>

      <SocialToolkit />

      <p className="mt-12 max-w-prose text-xs text-slate">{CAMPAIGN.paidForBy}</p>
    </section>
  );
}
