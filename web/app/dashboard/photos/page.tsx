import { PageHeader } from "@/components/dashboard/Notice";
import { PhotoLibrary } from "@/components/dashboard/PhotoLibrary";

export const dynamic = "force-dynamic";

export default function PhotosPage() {
  return (
    <>
      <PageHeader kicker="Photography" title="Photo library" />
      <p className="mb-6 max-w-prose text-sm text-slate">
        Real shoot photos, staff-only via short-lived signed links. Upload originals with{" "}
        <span className="font-mono">sync-photos.mjs</span>; when you find a keeper, copy its promote
        command below to publish web-optimized versions to the site.
      </p>
      <PhotoLibrary />
    </>
  );
}
