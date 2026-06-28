import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { PhotoLibrary } from "@/components/dashboard/PhotoLibrary";
import { requireCap } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  await requireCap("manageAssets");
  return (
    <>
      <PageHeader kicker="Photography" title="Photo library" />
      <p className="mb-6 max-w-prose text-sm text-slate">
        Real shoot photos, staff-only via short-lived signed links. Upload originals with{" "}
        <span className="font-mono">sync-photos.mjs</span>; when you find a keeper, copy its promote
        command below to publish web-optimized versions to the site.
      </p>
      <HowTo
        steps={[
          "Browse the shoot photos below — staff-only, shown through short-lived signed links.",
          "Add new originals by running the sync-photos.mjs script (not an in-page upload).",
          "Found a keeper? Copy its “promote” command to publish a web-optimized version to the public site.",
          "Use promoted photos in the Graphics studio and across the public pages.",
        ]}
      />
      <PhotoLibrary />
    </>
  );
}
