"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 py-16 text-center">
      <div className="w-full max-w-lg">
        <div className="mx-auto mb-8 flex h-1 w-28" aria-hidden>
          <span className="h-full w-2/5 bg-brick" /><span className="h-full w-1/5 bg-paper" /><span className="h-full w-2/5 bg-field" />
        </div>
        <p className="eyebrow text-brick">Something went wrong</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">We hit a snag.</h1>
        <p className="mt-4 text-lg text-slate">Try again — if it keeps happening, reach the campaign and we&apos;ll sort it out.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-ghost">Back to home</Link>
        </div>
        <p className="mt-12 text-xs text-slate">Paid for by the Matt Grant for Congress Committee.</p>
      </div>
    </main>
  );
}
