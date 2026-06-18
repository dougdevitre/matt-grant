import type { Metadata } from "next";
import Image from "next/image";
import { MediaLibrary } from "@/components/MediaLibrary";
import { ASSETS_CDN } from "@/lib/site";

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
      <div className="mt-10">
        <MediaLibrary />
      </div>
      <p className="mt-8 text-xs text-slate">
        Messages reflect Matt's published platform. When you post, please keep the
        "{`Paid for by the Matt Grant for Congress Committee`}." line where required.
      </p>
    </section>
  );
}
