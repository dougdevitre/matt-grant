import type { Metadata } from "next";
import { MediaLibrary } from "@/components/MediaLibrary";

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
