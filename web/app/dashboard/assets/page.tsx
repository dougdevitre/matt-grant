import { PageHeader } from "@/components/dashboard/Notice";
import { AssetManager } from "@/components/dashboard/AssetManager";

export const dynamic = "force-dynamic";

export default function AssetsPage() {
  return (
    <>
      <PageHeader kicker="Brand" title="Asset library" />
      <p className="mb-6 max-w-prose text-sm text-slate">
        Store the logo, brand images, generated graphics, and staff documents in S3. Public assets are
        served over CloudFront (copy the URL into the site or a post); private files get short-lived
        signed links. Generate campaign graphics in the <span className="font-mono">Graphics studio</span>.
      </p>
      <AssetManager />
    </>
  );
}
