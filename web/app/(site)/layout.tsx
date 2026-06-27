import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AskMatt } from "@/components/AskMatt";
import { MobileActionBar } from "@/components/MobileActionBar";
import { clerkEnabled } from "@/lib/auth";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader clerkEnabled={clerkEnabled} />
      <main id="main">{children}</main>
      <SiteFooter />
      {/* Spacer so the footer clears the fixed mobile action bar. */}
      <div aria-hidden className="h-14 lg:hidden" />
      <MobileActionBar />
      <AskMatt />
    </>
  );
}
