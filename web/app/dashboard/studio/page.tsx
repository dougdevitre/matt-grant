import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { StudioForm } from "@/components/dashboard/StudioForm";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  return (
    <>
      <PageHeader kicker="Brand" title="Graphics studio" />
      <p className="mb-6 max-w-prose text-sm text-slate">
        Generate on-brand campaign graphics from Matt&apos;s photo — social posts, stories, headers, web
        banners, and yard signs. Pick a format, edit the copy, and download a print-ready PNG. Below,
        grab the ready-made brand-kit assets (favicon, profile photo, share card).
      </p>
      <HowTo
        steps={[
          "Pick a format — social post, story, header, web banner, or yard sign.",
          "Edit the copy fields so the text fits the message you are pushing.",
          "Download the print-ready PNG; it also lands in the Asset library for reuse.",
          "Below the form, grab the ready-made brand-kit assets (favicon, profile photo, share card).",
          "Printing what you make? Take the PNG to the St. Louis County Library — see the “Print at the library” callout on /media.",
        ]}
      />
      <StudioForm />
    </>
  );
}
