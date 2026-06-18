import { CAMPAIGN } from "@/lib/site";

// Shared shell for legal/policy content pages (Data Policy, Transparency,
// Commitment to Public Trust). Keeps typography and the closing disclaimer
// consistent across all three. Child content is plain h2/h3/p/ul/ol/a markup
// styled via the scoped child selectors below.
export function PolicyPage({
  eyebrow,
  title,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container-page py-16 sm:py-24">
      <div className="max-w-prose">
        <p className="eyebrow text-brick">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">{title}</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-slate">Last updated: {updated}</p>
        <p className="mt-6 text-lg leading-relaxed text-slate">{intro}</p>
      </div>

      <div className="mt-10 max-w-prose space-y-5 text-slate [&_a]:text-field [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>

      <div className="mt-12 max-w-prose border-t border-line pt-6 text-xs leading-relaxed text-slate">
        <p className="font-semibold text-ink">{CAMPAIGN.paidForBy}</p>
        <p className="mt-1">
          {CAMPAIGN.address} · {CAMPAIGN.email} · {CAMPAIGN.phone}
        </p>
      </div>
    </section>
  );
}
