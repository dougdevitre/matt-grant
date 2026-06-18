import { PageHeader } from "@/components/dashboard/Notice";
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
      <StudioForm />
    </>
  );
}
