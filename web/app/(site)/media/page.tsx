import type { Metadata } from "next";
import Image from "next/image";
import { MediaLibrary } from "@/components/MediaLibrary";
import { VideoPlaylist } from "@/components/VideoPlaylist";
import { ASSETS_CDN, CAMPAIGN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Media & Content",
  description:
    "Download Matt Grant for Congress graphics and post ready-made, on-message content to your social channels — one a day to August 4.",
};

export default function MediaPage() {
  return (
    <section className="container-page py-16 sm:py-20">
      <p className="eyebrow text-brick">Media & content</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">Share the mission.</h1>
      <p className="mt-5 max-w-prose text-lg text-slate">
        Everything you need to spread the word — campaign graphics to download, and 50 ready-to-post
        messages mapped to the issues, voter communities, and the countdown to August 4. Copy a
        caption, share it to your channel, or grab the artwork. Post one a day and carry us home.
      </p>
      <div className="relative mt-10 aspect-[16/9] w-full overflow-hidden rounded-lg border border-line shadow-card">
        <Image
          src={`${ASSETS_CDN}/public/marketing/banner-standard-of-service.png`}
          alt="A New Standard of Service — Matt Grant for Congress"
          fill
          sizes="(max-width: 1024px) 100vw, 1100px"
          className="object-cover"
          priority
        />
      </div>
      <div className="mt-12">
        <p className="eyebrow text-brick">Watch &amp; share</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Explainer videos.</h2>
        <p className="mt-4 max-w-prose text-slate">
          Share the series — short explainer videos on the platform. Press play, then
          pass the link to a neighbor.
        </p>
        <div className="mt-6">
          <VideoPlaylist />
        </div>
      </div>
      <div className="mt-10">
        <MediaLibrary />
      </div>
      <div className="mt-12 rounded-lg border border-line bg-white p-8 shadow-card sm:p-10">
        <p className="eyebrow text-brick">Print it for pennies</p>
        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
          Print these at the St. Louis County Library.
        </h2>
        <p className="mt-4 max-w-prose text-slate">
          You don&apos;t need a budget to make a difference — you need a library card. Print flyers and
          palm cards from any branch (every cardholder gets <strong>$5 of free printing a month</strong>,
          about 50 black-and-white pages), or make <strong>yard-window signs, banners, T-shirts, and
          video</strong> at the Clark Family Branch creative lab for the cost of materials.
        </p>
        <p className="mt-4 max-w-prose text-slate">
          A few rules keep it legal: keep the &ldquo;{CAMPAIGN.paidForBy}&rdquo; line intact, only post
          signs on private property with the owner&apos;s permission (never on roadsides or
          right-of-way), and stay 25+ feet from any polling place on election day.
        </p>
        <a
          href="https://www.slcl.org"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block font-semibold text-brick underline underline-offset-4"
        >
          Set up library printing at slcl.org &rarr;
        </a>
      </div>
      <p className="mt-8 text-xs text-slate">
        Messages reflect Matt&apos;s published platform. When you post, please keep the
        &ldquo;{CAMPAIGN.paidForBy}&rdquo; line where required.
      </p>
    </section>
  );
}
