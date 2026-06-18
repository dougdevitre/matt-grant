import Link from "next/link";
import Image from "next/image";
import { CAMPAIGN } from "@/lib/site";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/issues", label: "Issues" },
  { href: "/act", label: "Take Action" },
  { href: "/donate", label: "Donate" },
  { href: "/contact", label: "Contact" },
];

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 py-16 text-center">
      <div className="w-full max-w-lg">
        <div className="mx-auto mb-8 flex h-1 w-28" aria-hidden>
          <span className="h-full w-2/5 bg-brick" /><span className="h-full w-1/5 bg-paper" /><span className="h-full w-2/5 bg-field" />
        </div>
        <Image src="/brand/logo.png" alt={`${CAMPAIGN.candidate} for Congress`} width={150} height={48} className="mx-auto h-11 w-auto" priority />
        <p className="eyebrow mt-10 text-brick">Error 404</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">We couldn&apos;t find that page.</h1>
        <p className="mt-4 text-lg text-slate">It may have moved or never existed. Here&apos;s the way back.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-sm border border-line px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink hover:bg-white">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="mt-12 text-xs text-slate">{CAMPAIGN.paidForBy}</p>
      </div>
    </main>
  );
}
