import Link from "next/link";
import { HowTo, PageHeader } from "@/components/dashboard/Notice";
import { AssetManager } from "@/components/dashboard/AssetManager";

export const dynamic = "force-dynamic";

export default function AssetsPage() {
  return (
    <>
      <PageHeader kicker="Brand" title="Asset library">
        <Link href="/dashboard/photos" className="btn-ghost text-sm">
          Photo library →
        </Link>
      </PageHeader>
      <p className="mb-6 max-w-prose text-sm text-slate">
        Store the logo, brand images, generated graphics, and staff documents in S3. Public assets are
        served over CloudFront (copy the URL into the site or a post); private files get short-lived
        signed links. Generate campaign graphics in the <span className="font-mono">Graphics studio</span>,
        and find shoot photos in the <Link href="/dashboard/photos" className="underline">Photo library</Link>.
      </p>
      <HowTo
        steps={[
          "Find the asset you need in the library below (logo, brand images, generated graphics, staff docs).",
          "For a public asset, copy its CloudFront URL and paste it into the site or a social post.",
          "For a private/staff file, use its short-lived signed link — it expires, so grab it when you need it.",
          "Missing a graphic? Create it in the Graphics studio; it saves back here automatically.",
          "To print any of these for pennies, see the “Print at the library” callout on the public /media page.",
        ]}
      />
      <AssetManager />
    </>
  );
}
