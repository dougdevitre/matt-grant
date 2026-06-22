import Image from "next/image";
import type { Metadata } from "next";
import { requireCap } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/Notice";
import { CaseForChange } from "@/components/CaseForChange";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peace Room — the case for change" };

// The staff/partner view of the shared case-for-change board (gated on
// viewPeaceRoom). The board itself is the reusable <CaseForChange/> — the same
// component the public community hub renders for supporters.
export default async function PeaceRoomPage() {
  await requireCap("viewPeaceRoom");
  return (
    <>
      <div className="mb-6 flex justify-center">
        <Image
          src="https://d5jzyan9wboi3.cloudfront.net/public/brand/logo.png"
          alt="Matt Grant for Congress — Missouri District 2"
          width={220}
          height={220}
          priority
          className="h-auto w-40 sm:w-48"
        />
      </div>
      <PageHeader kicker="Restore public trust" title="The case for change" />
      <CaseForChange />
      <p className="mt-8 max-w-3xl text-xs text-slate">
        Educational and informational only. Partners and supporters see this shared case and nothing
        else — donors, finance, compliance, and internal campaign data stay private to the team.
      </p>
    </>
  );
}
